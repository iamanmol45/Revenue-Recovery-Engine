import os
import sys
import argparse
import pandas as pd
from sqlalchemy import func

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.connection import SessionLocal
from models.recovery import RecoveryPrediction
from models.payment import Payment
from models.customer import Customer
from models.recovery_attempt import RecoveryAttempt

RAW_CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "transactions.csv")
SCORED_CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "recovery_scored_transactions.csv")

CUSTOMER_BATCH_SIZE = 10000
PAYMENT_BATCH_SIZE = 2000
PREDICTION_BATCH_SIZE = 5000

def validate_and_map():
    print("Loading raw dataset...")
    raw_df = pd.read_csv(RAW_CSV_PATH)
    raw_df['dt'] = pd.to_datetime(raw_df['created_at'], utc=True)
    
    print("Loading processed dataset...")
    scored_df = pd.read_csv(SCORED_CSV_PATH)
    scored_df['dt'] = pd.to_datetime(scored_df['created_at'], utc=True)

    # 1. Validation of RAW
    raw_count = len(raw_df)
    unique_bookings = raw_df['booking_id'].nunique()
    unique_customers = raw_df['customer_id'].nunique()
    
    print("\n--- VALIDATING RAW DATASET ---")
    print(f"Raw rows: {raw_count}")
    print(f"Unique booking IDs: {unique_bookings}")
    print(f"Unique customer IDs: {unique_customers}")
    
    if raw_count != 852584 or unique_bookings != 852584:
        print("ERROR: Raw dataset validation failed!")
        sys.exit(1)
        
    # 2. Validation of SCORED
    scored_count = len(scored_df)
    print("\n--- VALIDATING SCORED DATASET ---")
    print(f"Processed rows: {scored_count}")
    
    if scored_count != 170517:
        print("ERROR: Scored dataset validation failed!")
        sys.exit(1)
        
    # 3. Join Validation
    print("\n--- JOIN VALIDATION ---")
    merged_df = pd.merge(
        scored_df, 
        raw_df, 
        on=['dt', 'total_amount'], 
        how='inner'
    )
    
    match_count = len(merged_df)
    unmatched_count = scored_count - match_count
    duplicate_count = merged_df.duplicated(subset=['booking_id']).sum()
    
    print(f"Processed-to-raw matches: {match_count}")
    print(f"Unmatched processed rows: {unmatched_count}")
    print(f"Duplicate matches: {duplicate_count}")
    
    if match_count != 170517 or unmatched_count != 0 or duplicate_count != 0:
        print("ERROR: Join validation failed!")
        sys.exit(1)

    # 4. Critical Business Validation
    print("\n--- CRITICAL BUSINESS VALIDATION (ALL TRANSACTIONS) ---")
    total_payment_amt = raw_df['total_amount'].sum()
    success_count = (raw_df['payment_status'] == 'Success').sum()
    failed_count = (raw_df['payment_status'] == 'Failed').sum()
    success_rate = success_count / raw_count
    failure_rate = failed_count / raw_count
    
    print(f"Total payment amount: {total_payment_amt}")
    print(f"Successful payment count: {success_count}")
    print(f"Failed payment count: {failed_count}")
    print(f"Success rate: {success_rate:.2%}")
    print(f"Failure rate: {failure_rate:.2%}")
    
    print("\n--- CRITICAL BUSINESS VALIDATION (SCORED SUBSET) ---")
    scored_revenue_at_risk = scored_df['revenue_at_risk'].sum()
    scored_est_recoverable = scored_df['estimated_recoverable_revenue'].sum()
    scored_total_amt = merged_df['total_amount'].sum()
    scored_success = (merged_df['payment_status'] == 'Success').sum()
    scored_failed = (merged_df['payment_status'] == 'Failed').sum()
    
    print(f"Scored Total amount: {scored_total_amt}")
    print(f"Scored Successful count: {scored_success}")
    print(f"Scored Failed count: {scored_failed}")
    print(f"Total predicted revenue at risk: {scored_revenue_at_risk:.2f}")
    print(f"Total estimated recoverable revenue: {scored_est_recoverable:.2f}")
    
    return raw_df, merged_df

def prepare_records(raw_df, merged_df):
    # Customers
    unique_customers = raw_df['customer_id'].unique()
    customer_records = [{"customer_id": str(cid), "name": f"Customer {cid}"} for cid in unique_customers]
    
    # Payments
    print("Preparing Payment records (852k)...")
    # For performance, construct dicts directly using iterators or to_dict
    payment_records = []
    for _, row in raw_df.iterrows():
        payment_records.append({
            "payment_id": str(row['booking_id']),
            "customer_id": str(row['customer_id']),
            "amount": float(row['total_amount']),
            "status": str(row['payment_status']).lower(),
            "payment_method": str(row['payment_method']) if pd.notnull(row['payment_method']) else None,
            "created_at": row['dt'].to_pydatetime().replace(tzinfo=None)
        })
        
    # Predictions
    print("Preparing Prediction records (170k)...")
    prediction_records = []
    for _, row in merged_df.iterrows():
        prediction_records.append({
            "payment_id": str(row['booking_id']),
            "customer_id": str(row['customer_id']),
            "failure_probability": float(row['failure_probability']),
            "revenue_at_risk": float(row['revenue_at_risk']),
            "recovery_priority": str(row['recovery_priority']),
            "recovery_action": str(row['recovery_action']),
            "estimated_recovery_rate": float(row['estimated_recovery_rate']) if pd.notnull(row['estimated_recovery_rate']) else None,
            "estimated_recoverable_revenue": float(row['estimated_recoverable_revenue']) if pd.notnull(row['estimated_recoverable_revenue']) else None,
            "created_at": row['dt'].to_pydatetime().replace(tzinfo=None)
        })
        
    return customer_records, payment_records, prediction_records

def load_data(dry_run=False, reset=False, confirm_reset=False):
    raw_df, merged_df = validate_and_map()
    
    db = SessionLocal()
    
    # Inspect current DB counts
    cur_cust = db.query(func.count(Customer.id)).scalar()
    cur_pay = db.query(func.count(Payment.id)).scalar()
    cur_pred = db.query(func.count(RecoveryPrediction.id)).scalar()
    cur_att = db.query(func.count(RecoveryAttempt.id)).scalar()
    
    print("\n--- CURRENT DATABASE COUNTS ---")
    print(f"Customers: {cur_cust}")
    print(f"Payments: {cur_pay}")
    print(f"RecoveryPredictions: {cur_pred}")
    print(f"RecoveryAttempts: {cur_att}")
    
    customer_records, payment_records, prediction_records = prepare_records(raw_df, merged_df)
    
    if dry_run:
        print("\n--- DRY RUN RESULTS ---")
        print(f"Customers to insert: {len(customer_records)}")
        print(f"Payments to insert: {len(payment_records)}")
        print(f"Predictions to insert: {len(prediction_records)}")
        print("DRY RUN COMPLETE — NO DATABASE MODIFICATIONS MADE")
        db.close()
        return

    if not reset:
        print("\nERROR: Database contains records. Use --reset to replace the current dataset.")
        print("Without --reset, this loader refuses to overwrite conflicting records.")
        db.close()
        sys.exit(1)
        
    if reset and not confirm_reset:
        print("\nWARNING: This will replace the current database contents.")
        print(f"Current rows: Customers={cur_cust}, Payments={cur_pay}, Predictions={cur_pred}")
        print("ERROR: --confirm-reset is required to proceed with --reset.")
        db.close()
        sys.exit(1)

    print("\nWARNING: This will replace the current database contents.")
    print("Resetting database tables...")
    try:
        db.query(RecoveryPrediction).delete()
        db.query(Payment).delete()
        db.query(Customer).delete()
        db.commit()
        
        print(f"Inserting Customers ({len(customer_records)})...")
        for i in range(0, len(customer_records), CUSTOMER_BATCH_SIZE):
            chunk = customer_records[i:i+CUSTOMER_BATCH_SIZE]
            db.bulk_insert_mappings(Customer, chunk)
            db.commit()
            
        print(f"Inserting Payments ({len(payment_records)})...")
        for i in range(0, len(payment_records), PAYMENT_BATCH_SIZE):
            chunk = payment_records[i:i+PAYMENT_BATCH_SIZE]
            db.bulk_insert_mappings(Payment, chunk)
            db.commit()
            print(f"  Inserted {min(i+PAYMENT_BATCH_SIZE, len(payment_records))} / {len(payment_records)}")
            
        print(f"Inserting Predictions ({len(prediction_records)})...")
        for i in range(0, len(prediction_records), PREDICTION_BATCH_SIZE):
            chunk = prediction_records[i:i+PREDICTION_BATCH_SIZE]
            db.bulk_insert_mappings(RecoveryPrediction, chunk)
            db.commit()
            print(f"  Inserted {min(i+PREDICTION_BATCH_SIZE, len(prediction_records))} / {len(prediction_records)}")
            
        print("\n--- POST-LOAD VALIDATION ---")
        post_cust = db.query(func.count(Customer.id)).scalar()
        post_pay = db.query(func.count(Payment.id)).scalar()
        post_pred = db.query(func.count(RecoveryPrediction.id)).scalar()
        post_att = db.query(func.count(RecoveryAttempt.id)).scalar()
        
        print(f"Customers: {post_cust}")
        print(f"Payments: {post_pay}")
        print(f"RecoveryPredictions: {post_pred}")
        print(f"RecoveryAttempts: {post_att}")
        
        print("Data loaded successfully!")
    except Exception as e:
        db.rollback()
        print("Error loading data:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Report counts without inserting")
    parser.add_argument("--reset", action="store_true", help="Delete existing data before inserting")
    parser.add_argument("--confirm-reset", action="store_true", help="Confirm deletion")
    args = parser.parse_args()
    
    load_data(dry_run=args.dry_run, reset=args.reset, confirm_reset=args.confirm_reset)