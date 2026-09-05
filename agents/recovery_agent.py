from sqlalchemy.orm import Session

from agents.tools import (
    get_payment_details,
    get_recovery_prediction,
    get_customer_history,
    get_payment_recovery_attempts,
)


def analyze_payment(db: Session, payment_id: str):
    """
    Analyze a payment and generate an operational recovery recommendation.
    Evaluates ML predictions, customer profile metrics, and historical recovery attempts.
    """

    # Fetch payment information, ML prediction, and historical recovery attempts
    payment = get_payment_details(db, payment_id)
    prediction = get_recovery_prediction(db, payment_id)
    attempts = get_payment_recovery_attempts(db, payment_id)

    # If neither payment nor prediction is found, return failure
    if not payment.get("found") and not prediction.get("found"):
        return {
            "success": False,
            "message": f"Payment or prediction '{payment_id}' not found"
        }

    # Extract customer_id if available
    customer_id = (
        payment.get("customer_id")
        if payment.get("found")
        else prediction.get("customer_id")
    )

    # Fetch customer history if customer ID exists
    customer_history = None
    if customer_id:
        customer_history = get_customer_history(db, customer_id)

    # Extract prediction details
    priority = (prediction.get("recovery_priority") if prediction.get("found") else "Low") or "Low"
    action = (prediction.get("recovery_action") if prediction.get("found") else "No Action") or "No Action"

    failure_probability = prediction.get("failure_probability", 0.0) if prediction.get("found") else 0.0
    revenue_at_risk = prediction.get("revenue_at_risk", 0.0) if prediction.get("found") else 0.0
    estimated_recoverable = prediction.get("estimated_recoverable_revenue", 0.0) if prediction.get("found") else 0.0
    recovery_rate = prediction.get("estimated_recovery_rate", 0.65) if prediction.get("found") else 0.65

    # Calculate total amount recovered across attempts
    total_amount_recovered = sum(a.get("amount_recovered", 0.0) or 0.0 for a in attempts)
    attempt_count = len(attempts)
    last_attempt = attempts[-1] if attempt_count > 0 else None

    from agents.customer_intelligence import build_intelligence_context
    intelligence = build_intelligence_context(db, payment_id)
    
    # ---------------------------------------------------------
    # REAL AI DECISION ENGINE INTEGRATION
    # ---------------------------------------------------------
    from agents.decision_engine import generate_ai_decision, DecisionEngineError
    
    payment_payload = payment if payment.get("found") else {
        "found": False,
        "payment_id": payment_id,
        "customer_id": customer_id
    }
    
    prediction_payload = {
        "failure_probability": failure_probability,
        "revenue_at_risk": revenue_at_risk,
        "recovery_priority": priority,
        "recovery_action": action,
        "estimated_recoverable_revenue": estimated_recoverable,
        "estimated_recovery_rate": recovery_rate
    }
    
    try:
        decision = generate_ai_decision(
            payment=payment_payload,
            prediction=prediction_payload,
            intelligence=intelligence,
            attempts=attempts
        )
        decision_source = "real LLM"
    except Exception as e:
        return {
            "success": False,
            "message": f"AI Decision Engine unavailable or failed: {str(e)}",
            "decision_source": "unavailable/error"
        }

    return {
        "success": True,
        "payment": payment_payload,
        "prediction": prediction_payload,
        "customer_history": customer_history,
        "attempts": attempts,
        "intelligence": intelligence,
        "agent_decision": {
            "decision_source": decision_source,
            "priority": priority,  # Preserve old field for UI
            "recommended_action": decision.recommended_action.value,
            "confidence": f"{int(decision.confidence * 100)}% Confidence",
            "reason": decision.action_reason,
            
            # New AI fields
            "diagnosis": decision.diagnosis,
            "risk_assessment": decision.risk_assessment,
            "evidence": decision.evidence,
            "expected_outcome": decision.expected_outcome,
            "escalation_required": decision.escalation_required,
            "stopping_condition": decision.stopping_condition,
            
            "next_step": decision.expected_outcome, # Map expected outcome to next_step for backwards compatibility
            "recovery_plan": [f"Execute {decision.recommended_action.value}"], # Bounded plan
            "execution_status": {
                "state": "Pending AI Action",
                "total_attempts": attempt_count,
                "last_action": last_attempt.get("action") if last_attempt else None,
                "last_status": last_attempt.get("status") if last_attempt else "Uninitiated",
                "amount_recovered": total_amount_recovered
            }
        }
    }
