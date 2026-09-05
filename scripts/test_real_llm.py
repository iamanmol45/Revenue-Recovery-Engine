import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()
from database.connection import SessionLocal
from models.payment import Payment
from models.recovery import RecoveryPrediction
from models.recovery_attempt import RecoveryAttempt

from agents.customer_intelligence import build_intelligence_context
from agents.context_builder import build_llm_context
from agents.llm_client import generate_recovery_decision


def main():
    print("=" * 60)
    print("REAL LLM SINGLE-RECORD TEST")
    print("=" * 60)

    db = SessionLocal()

    try:
        # ONE payment only
        # Get a prediction first to guarantee we have one
        prediction = db.query(RecoveryPrediction).first()

        if not prediction:
            print("ERROR: No recovery prediction found.")
            return
            
        # Get the corresponding payment
        payment = (
            db.query(Payment)
            .filter(Payment.payment_id == prediction.payment_id)
            .first()
        )

        if not payment:
            print("ERROR: No payment found for the prediction.")
            return

        if not prediction:
            print("ERROR: No recovery prediction found for this payment.")
            return

        # Existing recovery attempts for this payment
        attempts = (
            db.query(RecoveryAttempt)
            .filter(RecoveryAttempt.payment_id == payment.payment_id)
            .all()
        )

        print("Prediction found:", True)
        print("Recovery attempts:", len(attempts))

        # Customer intelligence for ONE payment
        intelligence = build_intelligence_context(
            db,
            payment.payment_id
        )

        # Convert models to dicts for context builder
        payment_dict = {
            "payment_id": payment.payment_id,
            "amount": float(payment.amount),
            "payment_method": payment.payment_method,
            "status": payment.status,
            "customer_id": payment.customer_id
        }
        
        prediction_dict = {
            "failure_probability": prediction.failure_probability,
            "revenue_at_risk": float(prediction.revenue_at_risk) if prediction.revenue_at_risk else None,
            "recovery_priority": prediction.recovery_priority,
            "recovery_action": prediction.recovery_action,
            "estimated_recoverable_revenue": float(prediction.estimated_recoverable_revenue) if prediction.estimated_recoverable_revenue else None,
            "estimated_recovery_rate": prediction.estimated_recovery_rate
        }
        
        attempts_list = [{"id": a.id, "action": a.action, "status": a.status} for a in attempts]

        # Build the already-optimized LLM context
        context = build_llm_context(
            payment=payment_dict,
            prediction=prediction_dict,
            intelligence=intelligence,
            attempts=attempts_list
        )

        context_text = json.dumps(context, default=str)

        print("\nLLM CONTEXT:")
        print(json.dumps(context, indent=2, default=str))

        print(
            "\nContext size:",
            len(context_text.encode("utf-8")),
            "bytes"
        )

        print("\nCalling LLM...")

        # EXACTLY ONE LLM REQUEST
        decision = generate_recovery_decision(context)

        print("\nLLM DECISION:")
        print(decision.model_dump_json(indent=2))

        print("\nSUCCESS: Real LLM call completed.")

    except Exception as e:
        print("\nERROR:", type(e).__name__, str(e))

    finally:
        db.close()
        print("\nDatabase connection closed.")


if __name__ == "__main__":
    main()