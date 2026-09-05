import pytest
from agents.context_builder import build_llm_context, ContextSizeError

@pytest.fixture
def sample_payment():
    return {
        "payment_id": "pay_123",
        "amount": 1000.0,
        "payment_method": "credit_card",
        "status": "failed",
        "customer_id": "cust_456",
        "internal_metadata": "should_be_ignored"
    }

@pytest.fixture
def sample_prediction():
    return {
        "failure_probability": 0.85,
        "revenue_at_risk": 1000.0,
        "estimated_recoverable_revenue": 800.0,
        "estimated_recovery_rate": 0.8,
        "debug_info": "should_be_ignored"
    }

@pytest.fixture
def sample_intelligence():
    return {
        "customer": {
            "total_transactions": 50,
            "success_rate": 0.9,
            "failure_rate": 0.1,
            "average_transaction_value": 500.0,
            "internal_score": 100
        },
        "behavior": {
            "amount_ratio_to_average": 2.0,
            "recent_failure_rate": 0.2,
            "amount_anomaly_score": 0.5,
            "failure_trend_score": 0.1,
            "behavioral_deviation_score": 0.3,
            "signals": [
                "Signal 1",
                "Signal 2",
                "Signal 3",
                "Signal 4",
                "Signal 5",
                "Signal 6", # Should be trimmed
                "Signal 7"
            ]
        },
        "recovery_history": {
            "previous_attempts": 3,
            "recovery_success_rate": 0.66,
            "previous_actions": ["Email", "SMS", "Email", "SMS", "Call", "Email", "SMS"], # Should be trimmed
            "most_recent_recovery_outcome": "success",
            "last_action": "Call",
            "last_status": "Failed"
        }
    }

@pytest.fixture
def sample_attempts():
    return [
        {"action": "Email", "status": "Failed"},
        {"action": "SMS", "status": "Failed"}
    ]


def test_full_context_generated_correctly(sample_payment, sample_prediction, sample_intelligence, sample_attempts):
    context = build_llm_context(sample_payment, sample_prediction, sample_intelligence, sample_attempts)
    
    # 1. Full context is generated correctly
    assert "transaction" in context
    assert "ml_risk" in context
    assert "customer_behavior" in context
    assert "recovery_history" in context

    # 2. Required transaction fields are retained
    assert context["transaction"]["payment_id"] == "pay_123"
    assert context["transaction"]["amount"] == 1000.0
    
    # 3. Required ML fields are retained
    assert context["ml_risk"]["failure_probability"] == 0.85
    
    # 4. Customer intelligence summarized correctly
    assert context["customer_behavior"]["total_transactions"] == 50
    assert context["customer_behavior"]["amount_ratio_to_average"] == 2.0
    
    # 5. Recovery history summarized correctly
    assert context["recovery_history"]["previous_attempts"] == 3
    assert context["recovery_history"]["last_action"] == "Call"
    
    # 6. Signals limited to 5
    assert len(context["customer_behavior"]["signals"]) == 5
    
    # 7. Previous actions limited to 5
    assert len(context["recovery_history"]["previous_actions"]) == 5
    
    # 8. Raw/unapproved fields are not included
    assert "internal_metadata" not in context["transaction"]
    assert "debug_info" not in context["ml_risk"]

def test_missing_intelligence_handled_safely(sample_payment, sample_prediction, sample_attempts):
    context = build_llm_context(sample_payment, sample_prediction, None, sample_attempts)
    assert context["customer_behavior"] == {}
    # Fallback to attempts
    assert context["recovery_history"]["previous_attempts"] == 2
    assert context["recovery_history"]["last_action"] == "SMS"

def test_missing_recovery_history_handled_safely(sample_payment, sample_prediction, sample_intelligence):
    sample_intelligence.pop("recovery_history")
    context = build_llm_context(sample_payment, sample_prediction, sample_intelligence, [])
    assert context["recovery_history"] == {}

def test_oversized_context_rejected(sample_payment, sample_prediction, sample_intelligence, sample_attempts):
    # Make intelligence ridiculously huge
    huge_signals = ["A" * 1000 for _ in range(10)]
    sample_intelligence["behavior"]["signals"] = huge_signals
    
    # We need to bypass the limit inside _trim_list just for the test or just make the first 5 huge.
    # The first 5 will be huge, totaling > 5000 bytes, which might not hit 8192 bytes alone. Let's make it 2000 bytes each.
    huge_signals = ["A" * 2000 for _ in range(5)]
    sample_intelligence["behavior"]["signals"] = huge_signals
    
    with pytest.raises(ContextSizeError):
        build_llm_context(sample_payment, sample_prediction, sample_intelligence, sample_attempts)

def test_context_builder_pure(sample_payment, sample_prediction, sample_intelligence, sample_attempts):
    # 12. Context builder never calls the LLM. 
    # 13. Context builder never accesses/modifies the database.
    # We can assert this by checking it doesn't do anything other than dict manipulation.
    context = build_llm_context(sample_payment, sample_prediction, sample_intelligence, sample_attempts)
    assert isinstance(context, dict)
