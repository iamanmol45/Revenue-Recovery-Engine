import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_create_and_get_customer(client):
    import uuid
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    payload = {
        "customer_id": cust_id,
        "name": "Test User",
        "email": "test@example.com"
    }
    response = client.post("/customers", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Customer created successfully"

    get_resp = client.get("/customers")
    assert get_resp.status_code == 200
    customers = get_resp.json()
    assert any(c["customer_id"] == cust_id for c in customers)


def test_create_and_get_payment(client):
    import uuid
    pay_id = f"pay_{uuid.uuid4().hex[:8]}"
    cust_id = f"cust_{uuid.uuid4().hex[:8]}"
    payload = {
        "payment_id": pay_id,
        "customer_id": cust_id,
        "amount": 999.50,
        "currency": "INR",
        "status": "captured",
        "payment_method": "card"
    }
    response = client.post("/payments", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Payment recorded successfully"

    get_resp = client.get("/payments")
    assert get_resp.status_code == 200
    payments = get_resp.json()
    assert any(p["payment_id"] == pay_id for p in payments)


def test_analytics_endpoints(client, db_session):
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
        from models.payment import Payment
        from models.recovery import RecoveryPrediction
        from models.customer import Customer
        
        # Seed test data using the isolated db_session
        if not db_session.query(Customer).filter_by(customer_id="cust_test").first():
            db_session.add(Customer(customer_id="cust_test", name="Test", email="t@t.com"))
            db_session.commit()
        if not db_session.query(Payment).filter_by(payment_id="ML_000001").first():
            db_session.add(Payment(payment_id="ML_000001", customer_id="cust_test", amount=100.0, status="failed"))
            db_session.add(RecoveryPrediction(payment_id="ML_000001", failure_probability=0.9, recovery_priority="High", revenue_at_risk=100.0, recovery_action="Retry Payment"))
            db_session.commit()
        
        overview_resp = client.get("/analytics/overview")
        assert overview_resp.status_code == 200
        assert "total_transactions" in overview_resp.json()

        queue_resp = client.get("/analytics/recovery-queue?limit=5")
        assert queue_resp.status_code == 200
        assert isinstance(queue_resp.json(), list)

        priorities_resp = client.get("/analytics/priorities")
        assert priorities_resp.status_code == 200
        assert isinstance(priorities_resp.json(), list)

        analyze_resp = client.get("/analytics/analyze/ML_000001")
        assert analyze_resp.status_code == 200
        assert analyze_resp.json().get("success") is True

        recover_resp = client.post("/analytics/recover/ML_000001")
        assert recover_resp.status_code == 200
        assert recover_resp.json().get("success") is True


def test_recovery_history_and_outcomes(client, db_session):
    from unittest.mock import patch
    from agents.schemas import RecoveryDecision, RecoveryActionEnum
    
    # Ensure test data exists for ML_000001
    from models.payment import Payment
    from models.recovery import RecoveryPrediction
    from models.customer import Customer
    if not db_session.query(Customer).filter_by(customer_id="cust_test").first():
        db_session.add(Customer(customer_id="cust_test", name="Test", email="t@t.com"))
    if not db_session.query(Payment).filter_by(payment_id="ML_000001").first():
        db_session.add(Payment(payment_id="ML_000001", customer_id="cust_test", amount=100.0, status="failed"))
        db_session.add(RecoveryPrediction(payment_id="ML_000001", failure_probability=0.9, recovery_priority="High", revenue_at_risk=100.0, recovery_action="Retry Payment"))
    db_session.commit()
    
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
        import uuid
        test_pay_id = f"ML_{uuid.uuid4().hex[:6]}"

        # 1. Create attempt for a test payment ID via POST /analytics/recover
        rec_resp = client.post(f"/analytics/recover/ML_000001")
        assert rec_resp.status_code == 200
        rec_data = rec_resp.json()
        assert rec_data.get("success") is True
        attempt_1 = rec_data["recovery_attempt"]
        attempt_1_id = attempt_1["id"]

        rec_resp_2 = client.post(f"/analytics/recover/ML_000001")
        assert rec_resp_2.status_code == 200
        attempt_2 = rec_resp_2.json()["recovery_attempt"]
        attempt_2_id = attempt_2["id"]

        # 2. GET all recovery attempts
        all_attempts_resp = client.get("/analytics/recovery-attempts")
        assert all_attempts_resp.status_code == 200
        all_attempts = all_attempts_resp.json()
        assert isinstance(all_attempts, list)
        assert any(a["id"] == attempt_1_id for a in all_attempts)

        # 3. GET payment-specific recovery history
        pay_attempts_resp = client.get(f"/analytics/recovery-attempts/ML_000001")
        assert pay_attempts_resp.status_code == 200
        pay_attempts = pay_attempts_resp.json()
        assert isinstance(pay_attempts, list)
        assert len(pay_attempts) >= 2
        # Verify sequence order (attempt_number ascending)
        numbers = [a["attempt_number"] for a in pay_attempts]
        assert numbers == sorted(numbers)

        # 4. Resolve attempt_1 successfully
        resolve_succ = client.patch(
            f"/analytics/recovery-attempts/{attempt_1_id}",
            json={"status": "Successful", "amount_recovered": 5000.0}
        )
        assert resolve_succ.status_code == 200
        resolved_data = resolve_succ.json()
        assert resolved_data["success"] is True
        assert resolved_data["recovery_attempt"]["status"] == "Successful"
        assert resolved_data["recovery_attempt"]["amount_recovered"] == 5000.0
        assert resolved_data["recovery_attempt"]["completed_at"] is not None

        # 5. Resolve attempt_2 as Failed
        resolve_fail = client.patch(
            f"/analytics/recovery-attempts/{attempt_2_id}",
            json={"status": "Failed", "amount_recovered": 0.0}
        )
        assert resolve_fail.status_code == 200
        assert resolve_fail.json()["recovery_attempt"]["status"] == "Failed"

        # 6. Test already-resolved attempt (attempt_1)
        already_resolved = client.patch(
            f"/analytics/recovery-attempts/{attempt_1_id}",
            json={"status": "Successful", "amount_recovered": 5000.0}
        )
        assert already_resolved.status_code == 400
        assert "already resolved" in already_resolved.json()["detail"].lower()

        # 7. Test invalid status
        invalid_status = client.patch(
            f"/analytics/recovery-attempts/{attempt_1_id}",
            json={"status": "InvalidStatus", "amount_recovered": 100.0}
        )
        assert invalid_status.status_code == 422 or invalid_status.status_code == 400

        # 8. Test invalid attempt ID
        invalid_id = client.patch(
            "/analytics/recovery-attempts/99999999",
            json={"status": "Successful", "amount_recovered": 100.0}
        )
        assert invalid_id.status_code == 404
        assert "not found" in invalid_id.json()["detail"].lower()
