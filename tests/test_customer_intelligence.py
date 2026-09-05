import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from models.payment import Payment
from models.customer import Customer
from models.recovery_attempt import RecoveryAttempt
from models.recovery import RecoveryPrediction
from agents.customer_intelligence import build_intelligence_context

def test_build_intelligence_context_full_history(db_session: Session):
    """
    Test 1: Customer with historical transactions, previous failed transactions, 
    previous recovery attempts, and a successful recovery.
    """
    # Create customer
    c1 = Customer(customer_id="cust_intel_01", name="Intel Cust 1", email="intel1@example.com")
    db_session.add(c1)
    
    # Create historical payments
    # P1: successful, 1000
    p1 = Payment(payment_id="pay_intel_1", customer_id="cust_intel_01", amount=1000, status="successful")
    # P2: failed, 2000
    p2 = Payment(payment_id="pay_intel_2", customer_id="cust_intel_01", amount=2000, status="failed")
    # P3: failed, 500
    p3 = Payment(payment_id="pay_intel_3", customer_id="cust_intel_01", amount=500, status="failed")
    db_session.add_all([p1, p2, p3])
    
    # Current payment (anomaly test: 3000 > 1166 avg)
    p4 = Payment(payment_id="pay_intel_curr", customer_id="cust_intel_01", amount=3000, status="failed")
    db_session.add(p4)
    
    # Prediction for current payment
    pred = RecoveryPrediction(
        payment_id="pay_intel_curr", customer_id="cust_intel_01", 
        failure_probability=0.8, revenue_at_risk=3000, 
        recovery_priority="High", recovery_action="Immediate Recovery"
    )
    db_session.add(pred)
    
    # Recovery attempts for previous failures
    ra1 = RecoveryAttempt(payment_id="pay_intel_2", action="Immediate Recovery", status="Failed", amount_recovered=0)
    ra2 = RecoveryAttempt(payment_id="pay_intel_2", action="Retry Payment", status="Successful", amount_recovered=2000)
    ra3 = RecoveryAttempt(payment_id="pay_intel_3", action="Immediate Recovery", status="Pending", amount_recovered=0)
    db_session.add_all([ra1, ra2, ra3])
    
    db_session.commit()
    
    context = build_intelligence_context(db_session, "pay_intel_curr")
    
    assert context["customer"] is not None
    assert context["customer"]["total_transactions"] == 4
    assert context["customer"]["successful_transactions"] == 1
    assert context["customer"]["failed_transactions"] == 3
    assert context["customer"]["success_rate"] == 0.25
    assert context["customer"]["total_transaction_value"] == 6500.0
    assert context["customer"]["average_transaction_value"] == 1625.0
    
    assert context["current_transaction"]["amount"] == 3000.0
    
    assert context["behavior"]["amount_ratio_to_average"] == round(3000.0 / 1625.0, 2)
    assert context["behavior"]["historical_failure_rate"] == 0.75
    
    assert context["recovery_history"]["previous_attempts"] == 3
    assert context["recovery_history"]["successful_attempts"] == 1
    assert context["recovery_history"]["failed_attempts"] == 1
    assert context["recovery_history"]["total_amount_recovered"] == 2000.0

def test_build_intelligence_context_no_history(db_session: Session):
    """
    Test 2: Customer with no historical transactions (only current).
    """
    c2 = Customer(customer_id="cust_intel_02", name="Intel Cust 2")
    p_curr = Payment(payment_id="pay_intel_curr_2", customer_id="cust_intel_02", amount=1500, status="failed")
    db_session.add_all([c2, p_curr])
    db_session.commit()
    
    context = build_intelligence_context(db_session, "pay_intel_curr_2")
    assert context["customer"]["total_transactions"] == 1
    assert context["customer"]["success_rate"] == 0.0
    assert context["behavior"]["amount_ratio_to_average"] == 1.0
    assert context["recovery_history"]["previous_attempts"] == 0


def test_build_intelligence_context_missing_customer(db_session: Session):
    """
    Test 7: Missing/null customer information
    """
    # Prediction exists but no payment row and no customer row
    pred = RecoveryPrediction(
        payment_id="pay_intel_orphan", customer_id=None, 
        failure_probability=0.9, revenue_at_risk=5000, 
        recovery_priority="High", recovery_action="Immediate Recovery"
    )
    db_session.add(pred)
    db_session.commit()
    
    context = build_intelligence_context(db_session, "pay_intel_orphan")
    assert context["customer"] is None
    assert context["recovery_history"] is None
    assert context["behavior"] is None
    assert context["message"] == "Customer ID unavailable; unable to build intelligence context"


def test_build_intelligence_api_endpoint(db_session: Session, client: TestClient):
    """
    Test 8: Verify /analytics/analyze/{payment_id} endpoint returns the new context.
    """
    from unittest.mock import patch
    from agents.schemas import RecoveryDecision, RecoveryActionEnum
    
    mock_decision = RecoveryDecision(
        diagnosis="Mock",
        risk_assessment="High",
        evidence=["Mock evidence"],
        recommended_action=RecoveryActionEnum.RETRY_PAYMENT,
        action_reason="Mock reason",
        confidence=0.9,
        expected_outcome="Mock outcome",
        escalation_required=False,
        stopping_condition="Mock stop"
    )
    
    with patch("agents.decision_engine.generate_ai_decision", return_value=mock_decision):
        # Use data from test 1
        response = client.get("/analytics/analyze/pay_intel_curr")
        assert response.status_code == 200
        data = response.json()
        assert "intelligence" in data
        
        intel = data["intelligence"]
        
        # Verify same context is present in API response
        assert intel["customer"]["customer_id"] == "cust_intel_01"
        assert intel["behavior"]["amount_ratio_to_average"] > 1.0
