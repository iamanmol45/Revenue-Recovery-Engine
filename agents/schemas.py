from enum import Enum
from typing import List
from pydantic import BaseModel, Field


class RecoveryActionEnum(str, Enum):
    IMMEDIATE_RECOVERY = "Immediate Recovery"
    RETRY_PAYMENT = "Retry Payment"
    ALTERNATIVE_PAYMENT_METHOD = "Alternative Payment Method"
    ALTERNATIVE_PAYMENT = "Alternative Payment"
    ESCALATE_TO_CUSTOMER_OUTREACH = "Escalate to Customer Outreach"
    MANUAL_REVIEW = "Manual Review"


class RecoveryDecision(BaseModel):
    """
    Strict structured output contract for the LLM Decision Engine.
    Ensures the LLM reasoning is grounded and actionable.
    """
    diagnosis: str = Field(
        ...,
        description="A clear textual explanation diagnosing why the payment failed and the current context."
    )
    
    risk_assessment: str = Field(
        ...,
        description="Overall risk level (e.g., 'high', 'medium', 'low', 'critical')."
    )
    
    evidence: List[str] = Field(
        ...,
        min_length=1,
        description="A list of concrete evidence strings from the provided context supporting the decision."
    )
    
    recommended_action: RecoveryActionEnum = Field(
        ...,
        description="The specific recovery action chosen from the allowed list."
    )
    
    action_reason: str = Field(
        ...,
        description="Justification for why this specific recommended action was chosen over alternatives."
    )
    
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probability of success for the recommended action, expressed as a float between 0.0 and 1.0."
    )
    
    expected_outcome: str = Field(
        ...,
        description="The expected result if this action is executed."
    )
    
    escalation_required: bool = Field(
        ...,
        description="Boolean indicating if human intervention or customer outreach is strictly required."
    )
    
    stopping_condition: str = Field(
        ...,
        description="Condition under which the recovery workflow should halt."
    )
