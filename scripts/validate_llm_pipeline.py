import os
import sys
import json
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.connection import SessionLocal
from models.payment import Payment
from models.recovery import RecoveryPrediction
from models.recovery_attempt import RecoveryAttempt
from agents.customer_intelligence import build_intelligence_context
from agents.context_builder import build_llm_context

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate_llm_pipeline():
    logger.info("Connecting to production database (READ-ONLY mode)")
    db = SessionLocal()
    
    try:
        # 1. Select exactly ONE real payment that has an ML prediction
        prediction_record = db.query(RecoveryPrediction).first()
        if not prediction_record:
            logger.error("No RecoveryPrediction found in database!")
            return
            
        payment_record = db.query(Payment).filter(Payment.payment_id == prediction_record.payment_id).first()
        if not payment_record:
            logger.error(f"No corresponding Payment found for prediction with payment_id: {prediction_record.payment_id}")
            return
            
        logger.info(f"Selected Payment ID: {payment_record.payment_id}")
        
        # Format the dictionaries exactly as expected by our internal functions
        payment_dict = {
            "payment_id": payment_record.payment_id,
            "amount": float(payment_record.amount),
            "payment_method": payment_record.payment_method,
            "status": payment_record.status,
            "customer_id": payment_record.customer_id
        }
        
        prediction_dict = {
            "failure_probability": prediction_record.failure_probability,
            "revenue_at_risk": float(prediction_record.revenue_at_risk) if prediction_record.revenue_at_risk else None,
            "recovery_priority": prediction_record.recovery_priority,
            "recovery_action": prediction_record.recovery_action,
            "estimated_recoverable_revenue": float(prediction_record.estimated_recoverable_revenue) if prediction_record.estimated_recoverable_revenue else None,
            "estimated_recovery_rate": prediction_record.estimated_recovery_rate
        }
        
        # Get raw attempts
        attempts = db.query(RecoveryAttempt).filter(RecoveryAttempt.payment_id == payment_record.payment_id).all()
        attempts_list = [{"id": a.id, "action": a.action, "status": a.status} for a in attempts]
        
        # 2. Build existing customer intelligence
        logger.info("Building customer intelligence...")
        intelligence = build_intelligence_context(db, payment_record.payment_id)
        
        # 3. Pass the data through build_llm_context()
        logger.info("Generating LLM Context...")
        context = build_llm_context(
            payment=payment_dict,
            prediction=prediction_dict,
            intelligence=intelligence,
            attempts=attempts_list
        )
        
        # 4. Extract metrics
        serialized_context = json.dumps(context, indent=2)
        size_bytes = len(serialized_context.encode('utf-8'))
        
        # A rough estimate for tokens is bytes / 4. 
        # For a more exact token count with tiktoken we would need the library, but fallback to approx.
        estimated_tokens = size_bytes // 4
        
        # Print requested output
        print("\n" + "="*50)
        print("LLM PIPELINE VALIDATION (READ-ONLY)")
        print("="*50)
        print(f"1. Payment ID: {payment_record.payment_id}")
        print("\n2. Compact LLM Context:")
        print(serialized_context)
        print(f"\n3. Context Size: {size_bytes} bytes")
        print(f"4. Estimated Token Count: ~{estimated_tokens} tokens")
        print("="*50)
        
    finally:
        db.close()
        logger.info("Database connection safely closed.")

if __name__ == "__main__":
    validate_llm_pipeline()
