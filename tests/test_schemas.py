import pytest
from pydantic import ValidationError
import database.init_db
from agents.schemas import RecoveryDecision, RecoveryActionEnum

def get_valid_payload():
    return {
        "diagnosis": "Elevated failure risk combined with recent customer payment failures.",
        "risk_assessment": "high",
        "evidence": [
            "Failure probability: 96.6%",
            "Recent customer failure rate: 60%"
        ],
        "recommended_action": "Alternative Payment Method",
        "action_reason": "Repeated recent failures make identical retry less likely to succeed.",
        "confidence": 0.89,
        "expected_outcome": "Recover a portion of the exposed amount through an alternate route.",
        "escalation_required": False,
        "stopping_condition": "Stop recovery attempts after the configured maximum attempts."
    }

def test_valid_recovery_decision():
    """1. Valid RecoveryDecision"""
    payload = get_valid_payload()
    decision = RecoveryDecision(**payload)
    assert decision.recommended_action == RecoveryActionEnum.ALTERNATIVE_PAYMENT_METHOD
    assert decision.confidence == 0.89
    assert decision.escalation_required is False

def test_invalid_recovery_action():
    """2. Invalid recovery action"""
    payload = get_valid_payload()
    payload["recommended_action"] = "Some Made Up Action"
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "Input should be" in str(exc_info.value)

def test_confidence_below_zero():
    """3. Confidence below 0"""
    payload = get_valid_payload()
    payload["confidence"] = -0.1
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "Input should be greater than or equal to 0" in str(exc_info.value)

def test_confidence_above_one():
    """4. Confidence above 1"""
    payload = get_valid_payload()
    payload["confidence"] = 1.1
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "Input should be less than or equal to 1" in str(exc_info.value)

def test_missing_required_fields():
    """5. Missing required fields"""
    payload = get_valid_payload()
    del payload["action_reason"]
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "Field required" in str(exc_info.value)

def test_empty_evidence():
    """6. Empty evidence"""
    payload = get_valid_payload()
    payload["evidence"] = []
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "List should have at least 1 item after validation, not 0" in str(exc_info.value)

def test_invalid_data_types():
    """7. Invalid data types"""
    payload = get_valid_payload()
    payload["escalation_required"] = "not_a_boolean"
    with pytest.raises(ValidationError) as exc_info:
        RecoveryDecision(**payload)
    assert "Input should be a valid boolean" in str(exc_info.value)
