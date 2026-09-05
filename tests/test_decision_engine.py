import pytest
import database.init_db  # Pre-load to avoid circular import in agents/__init__.py
from unittest.mock import patch, MagicMock
from pydantic import ValidationError

from agents.schemas import RecoveryDecision, RecoveryActionEnum
from agents.decision_engine import generate_ai_decision, DecisionEngineError

@pytest.fixture
def dummy_payment():
    return {
        "payment_id": "pay_123",
        "amount": 500.0,
        "payment_method": "card",
        "status": "failed",
        "customer_id": "cust_123"
    }

@pytest.fixture
def dummy_prediction():
    return {
        "failure_probability": 0.9,
        "revenue_at_risk": 500.0,
        "recovery_priority": "High",
        "recovery_action": "Retry Payment",
        "estimated_recoverable_revenue": 300.0,
        "estimated_recovery_rate": 0.6
    }

@pytest.fixture
def dummy_intelligence():
    return {
        "customer": {
            "total_transactions": 10,
            "success_rate": 0.8,
            "failure_rate": 0.2,
            "average_transaction_value": 450.0,
            "most_recent_failed_transaction": "2026-09-01T10:00:00Z"
        },
        "behavior": {
            "amount_ratio_to_average": 1.1,
            "recent_failure_rate": 0.3,
            "amount_anomaly_score": 0.1,
            "failure_trend_score": 0.2,
            "behavioral_deviation_score": 0.2,
            "signals": ["test signal"]
        },
        "recovery_history": {
            "previous_attempts": 2,
            "recovery_success_rate": 0.5,
            "previous_actions": [{"action": "Retry Payment", "count": 2}],
            "most_recent_recovery_outcome": "Failed"
        }
    }

@pytest.fixture
def dummy_attempts():
    return [{"id": 1, "status": "Failed"}]

@pytest.fixture
def mock_valid_decision():
    return RecoveryDecision(
        diagnosis="Test diag",
        risk_assessment="High",
        evidence=["test"],
        recommended_action=RecoveryActionEnum.ALTERNATIVE_PAYMENT_METHOD,
        action_reason="test reason",
        confidence=0.8,
        expected_outcome="test outcome",
        escalation_required=False,
        stopping_condition="test stop"
    )

@patch("agents.decision_engine.generate_recovery_decision")
def test_full_context_assembled(mock_llm, dummy_payment, dummy_prediction, dummy_intelligence, dummy_attempts, mock_valid_decision):
    """Test 1-5, 8-9: Full context is assembled correctly and passed to LLM client."""
    mock_llm.return_value = mock_valid_decision
    
    result = generate_ai_decision(dummy_payment, dummy_prediction, dummy_intelligence, dummy_attempts)
    
    assert result == mock_valid_decision
    mock_llm.assert_called_once()
    
    context_passed = mock_llm.call_args[0][0]
    
    assert "transaction" in context_passed
    assert context_passed["transaction"]["payment_id"] == "pay_123"
    
    assert "ml_risk" in context_passed
    assert context_passed["ml_risk"]["failure_probability"] == 0.9
    
    assert "customer_behavior" in context_passed
    assert context_passed["customer_behavior"]["total_transactions"] == 10
    assert context_passed["customer_behavior"]["recent_failure_rate"] == 0.3
    
    assert "recovery_history" in context_passed
    assert context_passed["recovery_history"]["previous_attempts"] == 2

@patch("agents.decision_engine.generate_recovery_decision")
def test_missing_intelligence(mock_llm, dummy_payment, dummy_prediction, dummy_attempts, mock_valid_decision):
    """Test 6-7: Missing customer intelligence and recovery history remains null."""
    mock_llm.return_value = mock_valid_decision
    
    result = generate_ai_decision(dummy_payment, dummy_prediction, None, dummy_attempts)
    
    context_passed = mock_llm.call_args[0][0]
    
    assert context_passed["customer_behavior"] == {}
    # attempts_detail should still be passed in recovery_history fallback
    assert context_passed["recovery_history"]["previous_attempts"] == 1
    assert context_passed["recovery_history"]["last_status"] == "Failed"

@patch("agents.decision_engine.generate_recovery_decision")
def test_missing_prediction_rejected(mock_llm, dummy_payment, dummy_intelligence, dummy_attempts):
    """Test 11: Missing prediction data is rejected."""
    bad_prediction = {"failure_probability": 0.9} # missing others
    
    with pytest.raises(DecisionEngineError) as exc:
        generate_ai_decision(dummy_payment, bad_prediction, dummy_intelligence, dummy_attempts)
        
    assert "Missing required ML prediction field" in str(exc.value)
    
    with pytest.raises(DecisionEngineError):
        generate_ai_decision(dummy_payment, None, dummy_intelligence, dummy_attempts)

@patch("agents.decision_engine.generate_recovery_decision")
def test_llm_failure_propagated(mock_llm, dummy_payment, dummy_prediction, dummy_intelligence, dummy_attempts):
    """Test 10: LLM failure is propagated."""
    mock_llm.side_effect = Exception("LLM went down")
    
    with pytest.raises(DecisionEngineError) as exc:
        generate_ai_decision(dummy_payment, dummy_prediction, dummy_intelligence, dummy_attempts)
        
    assert "LLM client failed" in str(exc.value)
    assert "LLM went down" in str(exc.value.__cause__)
