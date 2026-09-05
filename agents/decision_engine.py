import logging
from typing import Dict, Any, List, Optional

from agents.schemas import RecoveryDecision
from agents.llm_client import generate_recovery_decision
from agents.context_builder import build_llm_context, ContextSizeError

logger = logging.getLogger(__name__)

class DecisionEngineError(Exception):
    """Raised when there is an error assembling context or processing the AI decision."""
    pass

def generate_ai_decision(
    payment: Dict[str, Any],
    prediction: Dict[str, Any],
    intelligence: Optional[Dict[str, Any]],
    attempts: List[Dict[str, Any]]
) -> RecoveryDecision:
    """
    Constructs a structured context from multiple sources and uses the LLM 
    to produce a recommended RecoveryDecision.

    Does not execute any actions. Does not use rule-based mappings.
    """
    logger.info("[Decision Engine] Building AI context")
    
    # 1. Validate required prediction data
    if not prediction:
        raise DecisionEngineError("Missing required ML prediction data.")
        
    required_prediction_fields = [
        "failure_probability", 
        "revenue_at_risk", 
        "recovery_priority"
    ]
    for field in required_prediction_fields:
        if field not in prediction:
            raise DecisionEngineError(f"Missing required ML prediction field: {field}")
            
    # 2. Build structured context payload
    
    try:
        structured_context = build_llm_context(
            payment=payment,
            prediction=prediction,
            intelligence=intelligence,
            attempts=attempts
        )
    except ContextSizeError as e:
        logger.error(f"[Decision Engine] Context size error: {e}")
        raise DecisionEngineError("LLM context exceeded maximum size limit.") from e
    
    logger.info("[Decision Engine] Sending context to LLM")
    
    # 3. Call LLM Client
    # We do NOT apply rule-based mapping (e.g. if priority == Critical -> Action).
    # We pass the data to the LLM and let it reason.
    try:
        decision = generate_recovery_decision(structured_context)
    except Exception as e:
        logger.error(f"[Decision Engine] Failed to generate AI decision: {e}")
        raise DecisionEngineError("LLM client failed to generate decision.") from e
        
    logger.info("[Decision Engine] AI decision validated")
    return decision
