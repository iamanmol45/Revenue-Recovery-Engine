import re
import json
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from agents.tools import get_payment_details, get_recovery_attempts, get_payment_recovery_attempts
from agents.llm_client import openai, os

logger = logging.getLogger(__name__)

def generate_chat_response_llm(message: str, context: Dict[str, Any]) -> str:
    """Uses LLM to answer complex questions based on the provided minimal context."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    model_name = os.environ.get("OPENROUTER_MODEL")
    
    if not api_key or not model_name:
        return "I'm unable to answer that because the LLM is not configured."
        
    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1"
    )
    
    system_prompt = (
        "You are an AI Revenue Assistant for a fintech dashboard. "
        "Answer the user's question using ONLY the provided context. "
        "Keep your answer under 100 words. Be professional and concise. "
        "Format all monetary values in Indian Rupees (₹). "
        "Do NOT invent numbers, payments, or data. If the answer is not in the context, explicitly say it is unavailable."
    )
    
    user_prompt = f"Context:\n{json.dumps(context, indent=2)}\n\nQuestion: {message}"
    
    try:
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=200
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"[Chat Agent] LLM Error: {e}")
        return "I encountered an error while analyzing that request. Please try again."

def format_currency(value: float) -> str:
    if value >= 1_000_000_000:
        return f"₹{value / 1_000_000_000:.2f}B"
    elif value >= 1_000_000:
        return f"₹{value / 1_000_000:.2f}M"
    elif value >= 1_000:
        return f"₹{value / 1_000:.2f}K"
    return f"₹{value:.2f}"

def handle_chat_message(message: str, db: Session) -> Dict[str, str]:
    """
    Processes the chat message and returns a response and the source.
    Uses rule-based heuristics first to save tokens.
    """
    msg_lower = message.lower()
    
    # Check for payment-specific questions
    payment_match = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', msg_lower)
    if payment_match:
        payment_id = payment_match.group(1)
        # Import dynamically to avoid circular import if needed, but we can use agents.tools directly
        payment_details = get_payment_details(db, payment_id)
        if not payment_details.get("found"):
            return {
                "answer": f"I couldn't find payment {payment_id} in the database.",
                "source": "database"
            }
        
        # Simple extraction
        if "status" in msg_lower:
            return {
                "answer": f"Payment {payment_id} has a status of '{payment_details.get('status')}'.",
                "source": "database"
            }
            
        # For more complex payment queries, use LLM with small context
        context = {
            "payment": payment_details
        }
        answer = generate_chat_response_llm(message, context)
        return {"answer": answer, "source": "ai"}

    # Heuristic 1: Overview / Financials
    if any(k in msg_lower for k in ["revenue at risk", "recoverable revenue", "overview", "exposure", "how much money"]):
        from api.main import get_overview
        overview = get_overview(db)
        
        at_risk = format_currency(overview['revenue_at_risk'])
        recoverable = format_currency(overview['estimated_recoverable_revenue'])
        tx_count = overview['total_transactions']
        
        return {
            "answer": f"Revenue at risk is {at_risk}, with an estimated {recoverable} recoverable across {tx_count:,} transactions.",
            "source": "database"
        }

    is_complex = any(k in msg_lower for k in ["strategy", "recommend", "revenue", "how much"])

    # Heuristic 2: Priorities
    if not is_complex and any(k in msg_lower for k in ["priority", "critical transactions", "high priority"]):
        from api.main import get_overview
        overview = get_overview(db)
        counts = overview['priority_counts']
        
        if "critical" in msg_lower:
            return {
                "answer": f"There are {counts.get('critical', 0)} critical priority transactions.",
                "source": "database"
            }
        
        answer = f"Here is the priority breakdown: Critical: {counts.get('critical', 0)}, High: {counts.get('high', 0)}, Medium: {counts.get('medium', 0)}, Low: {counts.get('low', 0)}."
        return {"answer": answer, "source": "database"}

    # Heuristic 3: Recovery Queue (highest risk, etc)
    if any(k in msg_lower for k in ["highest risk", "recover first", "biggest revenue at risk"]):
        from api.main import get_recovery_queue
        queue = get_recovery_queue(limit=1, db=db)
        if not queue:
            return {"answer": "The recovery queue is currently empty.", "source": "database"}
        
        top_tx = queue[0]
        at_risk = format_currency(top_tx['revenue_at_risk'])
        
        return {
            "answer": f"The highest risk transaction is Payment {top_tx['payment_id']} (Customer {top_tx['customer_id']}) with {at_risk} at risk. It has a {top_tx['failure_probability']:.1%} failure probability. Recommended action: {top_tx['recovery_action']}.",
            "source": "database"
        }
        
    # Heuristic 4: Recovery attempts
    if any(k in msg_lower for k in ["recovery attempt", "attempts", "how many attempts"]):
        attempts = get_recovery_attempts(db)
        total_attempts = len(attempts)
        successful = sum(1 for a in attempts if a['status'] == 'successful')
        total_recovered = sum(a.get('amount_recovered') or 0 for a in attempts if a['status'] == 'successful')
        
        return {
            "answer": f"There have been {total_attempts} recovery attempts in total. {successful} attempts were successful, recovering {format_currency(total_recovered)}.",
            "source": "database"
        }

    # Fallback: Let LLM answer based on overview + queue context (very constrained)
    from api.main import get_overview, get_recovery_queue
    from models.recovery import RecoveryPrediction
    
    overview = get_overview(db)
    queue = get_recovery_queue(limit=5, db=db)
    
    priority_results = db.query(
        RecoveryPrediction.recovery_priority,
        func.count(RecoveryPrediction.id),
        func.sum(RecoveryPrediction.revenue_at_risk),
        func.sum(RecoveryPrediction.estimated_recoverable_revenue)
    ).group_by(
        RecoveryPrediction.recovery_priority
    ).all()
    
    priorities = [
        {
            "priority": priority,
            "transaction_count": count,
            "revenue_at_risk": float(revenue_at_risk or 0),
            "estimated_recoverable": float(recoverable or 0)
        }
        for priority, count, revenue_at_risk, recoverable in priority_results
    ]
    
    context = {
        "overview": overview,
        "priorities": priorities,
        "top_5_queue": queue
    }
    
    answer = generate_chat_response_llm(message, context)
    return {"answer": answer, "source": "ai"}
