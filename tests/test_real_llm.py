"""
Real LLM validation - READ ONLY.

This script:
1. Reads exactly ONE payment from PostgreSQL.
2. Builds customer intelligence for that payment.
3. Builds the compact LLM context.
4. Sends that context to the configured LLM.
5. Prints the structured RecoveryDecision and token usage.

IMPORTANT:
- No INSERT / UPDATE / DELETE.
- No DROP / TRUNCATE.
- No init_db().
- No pytest.
- No recovery execution.
- Does not process the full dataset.
"""

import json
import os
import sys

from dotenv import load_dotenv

from database.connection import SessionLocal
from database.models import Payment
from agents.customer_intelligence import build_customer_intelligence
from agents.context_builder import build_llm_context
from agents.llm_client import generate_recovery_decision


load_dotenv()


def main():
    print("=" * 60)
    print("REAL LLM VALIDATION - READ ONLY")
    print("=" * 60)

    # Safety: require the LLM to be explicitly enabled.
    if os.getenv("LLM_ENABLED", "").lower() != "true":
        print("\nLLM_ENABLED is not set to true.")
        print("Set LLM_ENABLED=true in .env before running this script.")
        sys.exit(1)

    if not os.getenv("LLM_API_KEY"):
        print("\nLLM_API_KEY is missing.")
        sys.exit(1)

    if not os.getenv("LLM_MODEL"):
        print("\nLLM_MODEL is missing.")
        sys.exit(1)

    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # 1. Read EXACTLY ONE real payment
        # ---------------------------------------------------------
        payment = db.query(Payment).first()

        if payment is None:
            print("\nNo payment found in database.")
            sys.exit(1)

        print(f"\nPayment ID: {payment.id}")

        # ---------------------------------------------------------
        # 2. Read related prediction
        # ---------------------------------------------------------
        prediction = None

        if hasattr(payment, "recovery_prediction"):
            prediction = payment.recovery_prediction

        if prediction is None:
            print("\nNo recovery prediction found for this payment.")
            sys.exit(1)

        # Convert SQLAlchemy object to the dictionary format
        # expected by the existing decision engine.
        prediction_data = {
            "failure_probability": prediction.failure_probability,
            "revenue_at_risk": prediction.revenue_at_risk,
            "recovery_priority": prediction.recovery_priority,
            "recovery_action": prediction.recovery_action,
            "estimated_recoverable_revenue":
                prediction.estimated_recoverable_revenue,
            "estimated_recovery_rate":
                prediction.estimated_recovery_rate,
        }

        # ---------------------------------------------------------
        # 3. Get recovery attempts
        # ---------------------------------------------------------
        attempts = []

        if hasattr(payment, "recovery_attempts"):
            for attempt in payment.recovery_attempts:
                attempts.append({
                    "id": str(attempt.id),
                    "action": attempt.action,
                    "status": attempt.status,
                    "amount_recovered": attempt.amount_recovered,
                    "attempt_number": attempt.attempt_number,
                    "reason": attempt.reason,
                    "created_at": str(attempt.created_at)
                    if attempt.created_at else None,
                    "completed_at": str(attempt.completed_at)
                    if attempt.completed_at else None,
                })

        # ---------------------------------------------------------
        # 4. Build customer intelligence
        # ---------------------------------------------------------
        print("\nBuilding customer intelligence...")

        intelligence = build_customer_intelligence(
            db,
            payment.customer_id
        )

        # ---------------------------------------------------------
        # 5. Build COMPACT LLM context
        # ---------------------------------------------------------
        payment_data = {
            "payment_id": str(payment.id),
            "amount": float(payment.amount),
            "payment_method": payment.payment_method,
            "status": payment.status,
            "customer_id": str(payment.customer_id)
            if payment.customer_id is not None else None,
        }

        print("Building compact LLM context...")

        context = build_llm_context(
            payment=payment_data,
            prediction=prediction_data,
            intelligence=intelligence,
            attempts=attempts,
        )

        context_json = json.dumps(
            context,
            indent=2,
            default=str
        )

        context_bytes = len(context_json.encode("utf-8"))

        print("\n" + "-" * 60)
        print("COMPACT CONTEXT SENT TO LLM")
        print("-" * 60)
        print(context_json)

        print("\nContext size:", context_bytes, "bytes")
        print(
            "Estimated context tokens:",
            round(context_bytes / 4)
        )

        # ---------------------------------------------------------
        # 6. ONE REAL LLM CALL
        # ---------------------------------------------------------
        print("\nCalling real LLM...")
        print("Model:", os.getenv("LLM_MODEL"))

        decision = generate_recovery_decision(context)

        # ---------------------------------------------------------
        # 7. Print structured decision
        # ---------------------------------------------------------
        print("\n" + "=" * 60)
        print("REAL LLM DECISION")
        print("=" * 60)

        if hasattr(decision, "model_dump"):
            decision_data = decision.model_dump()
        else:
            decision_data = decision

        print(
            json.dumps(
                decision_data,
                indent=2,
                default=str
            )
        )

        print("\n" + "=" * 60)
        print("VALIDATION COMPLETE")
        print("=" * 60)

        print("\nDatabase operations performed:")
        print("READ ONLY")

        print("\nPayments processed:")
        print("1")

        print("\nRecovery execution:")
        print("NONE")

        print("\nDatabase writes:")
        print("NONE")

    finally:
        db.close()


if __name__ == "__main__":
    main()