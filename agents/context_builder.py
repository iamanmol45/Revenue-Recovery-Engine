import json
from typing import Dict, Any, List, Optional

class ContextSizeError(Exception):
    """Raised when the serialized LLM context exceeds the token/size limit."""
    pass

MAX_CONTEXT_BYTES = 8192  # Approx token limit mapping

def _trim_list(lst: Optional[List], limit: int = 5) -> List:
    if not lst:
        return []
    return lst[:limit]

def build_llm_context(
    payment: Dict[str, Any],
    prediction: Dict[str, Any],
    intelligence: Optional[Dict[str, Any]],
    attempts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Constructs a compact, token-efficient context for the LLM.
    Uses strict allowlisting.
    """
    
    # 1. Transaction
    transaction = {
        "payment_id": payment.get("payment_id"),
        "amount": payment.get("amount"),
        "payment_method": payment.get("payment_method"),
        "status": payment.get("status"),
        "customer_id": payment.get("customer_id")
    }
    
    # 2. ML Risk
    ml_risk = {
        "failure_probability": prediction.get("failure_probability"),
        "revenue_at_risk": prediction.get("revenue_at_risk"),
        "estimated_recoverable_revenue": prediction.get("estimated_recoverable_revenue"),
        "estimated_recovery_rate": prediction.get("estimated_recovery_rate")
    }
    
    # 3. Customer Behavior
    customer_behavior = {}
    if intelligence:
        cust = intelligence.get("customer", {})
        behav = intelligence.get("behavior", {})
        
        customer_behavior = {
            "total_transactions": cust.get("total_transactions"),
            "success_rate": cust.get("success_rate"),
            "failure_rate": cust.get("failure_rate"),
            "average_transaction_value": cust.get("average_transaction_value"),
            "amount_ratio_to_average": behav.get("amount_ratio_to_average"),
            "recent_failure_rate": behav.get("recent_failure_rate"),
            "amount_anomaly_score": behav.get("amount_anomaly_score"),
            "failure_trend_score": behav.get("failure_trend_score"),
            "behavioral_deviation_score": behav.get("behavioral_deviation_score"),
            "signals": _trim_list(behav.get("signals"), limit=5)
        }
        
    # 4. Recovery History
    recovery_history = {}
    if intelligence and "recovery_history" in intelligence:
        rec_hist = intelligence.get("recovery_history", {})
        recovery_history = {
            "previous_attempts": rec_hist.get("previous_attempts"),
            "recovery_success_rate": rec_hist.get("recovery_success_rate"),
            "previous_actions": _trim_list(rec_hist.get("previous_actions"), limit=5),
            "previous_recovery_outcomes": rec_hist.get("most_recent_recovery_outcome"),
            "last_action": rec_hist.get("last_action") if "last_action" in rec_hist else (attempts[-1].get("action") if attempts else None),
            "last_status": rec_hist.get("last_status") if "last_status" in rec_hist else (attempts[-1].get("status") if attempts else None),
        }
    elif attempts:
        # Fallback if no intelligence but attempts exist
        recovery_history = {
            "previous_attempts": len(attempts),
            "last_action": attempts[-1].get("action"),
            "last_status": attempts[-1].get("status")
        }
        
    context = {
        "transaction": transaction,
        "ml_risk": ml_risk,
        "customer_behavior": customer_behavior,
        "recovery_history": recovery_history
    }
    
    # Check size
    serialized = json.dumps(context)
    if len(serialized.encode('utf-8')) > MAX_CONTEXT_BYTES:
        raise ContextSizeError(f"Context size {len(serialized)} bytes exceeds maximum allowed {MAX_CONTEXT_BYTES} bytes.")
        
    return context
