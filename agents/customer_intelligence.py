from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.payment import Payment
from models.customer import Customer
from models.recovery_attempt import RecoveryAttempt
from models.recovery import RecoveryPrediction


def build_intelligence_context(db: Session, payment_id: str) -> Dict[str, Any]:
    """
    Builds a structured Customer Intelligence and Behavioral Analysis context
    based on PostgreSQL data for a given payment prediction.
    """
    # 1. Fetch current payment details
    current_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    prediction = db.query(RecoveryPrediction).filter(RecoveryPrediction.payment_id == payment_id).first()
    
    customer_id = None
    if current_payment:
        customer_id = current_payment.customer_id
    elif prediction:
        customer_id = prediction.customer_id
        
    current_tx_amount = float(current_payment.amount) if current_payment and current_payment.amount is not None else None
    
    current_transaction_data = {
        "payment_id": payment_id,
        "amount": current_tx_amount,
        "payment_method": current_payment.payment_method if current_payment else None,
        "status": current_payment.status if current_payment else None
    }
    
    if not customer_id:
        return {
            "customer": None,
            "current_transaction": current_transaction_data,
            "behavior": None,
            "recovery_history": None,
            "message": "Customer ID unavailable; unable to build intelligence context"
        }
        
    # 2. Customer Intelligence
    customer_record = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    
    # Aggregate transaction history using a single query
    tx_stats = db.query(
        func.count(Payment.id).label('total_count'),
        func.sum(Payment.amount).label('total_value'),
        func.avg(Payment.amount).label('avg_value'),
        func.max(Payment.amount).label('max_value'),
        func.min(Payment.amount).label('min_value')
    ).filter(Payment.customer_id == customer_id).first()
    
    status_stats = db.query(
        Payment.status,
        func.count(Payment.id)
    ).filter(Payment.customer_id == customer_id).group_by(Payment.status).all()
    
    total_tx = tx_stats.total_count if tx_stats and tx_stats.total_count is not None else 0
    successful_tx = sum([count for status, count in status_stats if status and status.lower() in ('success', 'successful')])
    failed_tx = sum([count for status, count in status_stats if status and status.lower() == 'failed'])
    
    success_rate = (successful_tx / total_tx) if total_tx > 0 else 0.0
    failure_rate = (failed_tx / total_tx) if total_tx > 0 else 0.0
    
    avg_tx_value = float(tx_stats.avg_value) if tx_stats and tx_stats.avg_value is not None else 0.0
    
    # Recent Transactions (last 5)
    recent_txs = db.query(Payment.status).filter(Payment.customer_id == customer_id).order_by(Payment.created_at.desc()).limit(5).all()
    recent_tx_count = len(recent_txs)
    recent_failed_tx_count = sum([1 for tx in recent_txs if tx.status and tx.status.lower() == 'failed'])
    recent_failure_rate = (recent_failed_tx_count / recent_tx_count) if recent_tx_count > 0 else 0.0
    
    # Most recent successful / failed
    most_recent_successful = db.query(Payment.created_at).filter(Payment.customer_id == customer_id, Payment.status.in_(['success', 'successful'])).order_by(Payment.created_at.desc()).first()
    most_recent_failed = db.query(Payment.created_at).filter(Payment.customer_id == customer_id, Payment.status == 'failed').order_by(Payment.created_at.desc()).first()
    most_recent = db.query(Payment.created_at).filter(Payment.customer_id == customer_id).order_by(Payment.created_at.desc()).first()
    
    customer_data = {
        "customer_id": customer_id,
        "name": customer_record.name if customer_record else None,
        "total_transactions": total_tx,
        "successful_transactions": successful_tx,
        "failed_transactions": failed_tx,
        "success_rate": round(success_rate, 4),
        "failure_rate": round(failure_rate, 4),
        "total_transaction_value": float(tx_stats.total_value) if tx_stats and tx_stats.total_value is not None else 0.0,
        "average_transaction_value": round(avg_tx_value, 2),
        "max_transaction_value": float(tx_stats.max_value) if tx_stats and tx_stats.max_value is not None else 0.0,
        "min_transaction_value": float(tx_stats.min_value) if tx_stats and tx_stats.min_value is not None else 0.0,
        "most_recent_transaction": most_recent[0].isoformat() if most_recent and most_recent[0] else None,
        "most_recent_successful_transaction": most_recent_successful[0].isoformat() if most_recent_successful and most_recent_successful[0] else None,
        "most_recent_failed_transaction": most_recent_failed[0].isoformat() if most_recent_failed and most_recent_failed[0] else None,
        "recent_transaction_count": recent_tx_count,
        "recent_failure_count": recent_failed_tx_count,
    }
    
    # 3. Behavioral Analysis & Signals
    amount_ratio_to_average = None
    if current_tx_amount is not None and avg_tx_value > 0:
        amount_ratio_to_average = current_tx_amount / avg_tx_value
        
    amount_anomaly_score = 0.0
    signals = []
    
    if amount_ratio_to_average is not None:
        if amount_ratio_to_average > 3.0:
            amount_anomaly_score = 0.9
            signals.append("Extremely high transaction amount compared to historical average (>3x)")
        elif amount_ratio_to_average > 2.0:
            amount_anomaly_score = 0.7
            signals.append("High transaction amount compared to historical average (>2x)")
        elif amount_ratio_to_average < 0.2:
            amount_anomaly_score = 0.5
            signals.append("Unusually low transaction amount compared to historical average (<0.2x)")
            
    failure_trend_score = 0.0
    if recent_failure_rate > failure_rate + 0.2:
        failure_trend_score = 0.8
        signals.append("Recent failure rate is significantly higher than historical average")
        
    behavioral_deviation_score = round(max(amount_anomaly_score, failure_trend_score), 2)
    
    behavior_data = {
        "amount_ratio_to_average": round(amount_ratio_to_average, 2) if amount_ratio_to_average is not None else None,
        "recent_failure_rate": round(recent_failure_rate, 4),
        "historical_failure_rate": round(failure_rate, 4),
        "amount_anomaly_score": amount_anomaly_score,
        "failure_trend_score": failure_trend_score,
        "behavioral_deviation_score": behavioral_deviation_score,
        "overall_anomaly_score": round((amount_anomaly_score + failure_trend_score) / 2.0, 2),
        "signals": signals
    }
    
    # 4. Recovery History Context
    recovery_stats = db.query(
        RecoveryAttempt.status,
        func.count(RecoveryAttempt.id).label('count'),
        func.sum(RecoveryAttempt.amount_recovered).label('amount_recovered')
    ).join(Payment, Payment.payment_id == RecoveryAttempt.payment_id)\
     .filter(Payment.customer_id == customer_id)\
     .group_by(RecoveryAttempt.status)\
     .all()
     
    previous_attempts = sum([int(r.count) for r in recovery_stats if r.count is not None])
    successful_attempts = sum([int(r.count) for r in recovery_stats if r.status and r.status.lower() in ('success', 'successful') and r.count is not None])
    failed_attempts = sum([int(r.count) for r in recovery_stats if r.status and r.status.lower() == 'failed' and r.count is not None])
    total_recovered = sum([float(r.amount_recovered) for r in recovery_stats if r.amount_recovered is not None])
    
    recovery_success_rate = (successful_attempts / previous_attempts) if previous_attempts > 0 else 0.0
    
    actions_used_raw = db.query(RecoveryAttempt.action, func.count(RecoveryAttempt.id).label('count'))\
        .join(Payment, Payment.payment_id == RecoveryAttempt.payment_id)\
        .filter(Payment.customer_id == customer_id)\
        .group_by(RecoveryAttempt.action)\
        .all()
        
    previous_actions = [{"action": a.action, "count": int(a.count) if a.count is not None else 0} for a in actions_used_raw]
    
    most_recent_recovery = db.query(RecoveryAttempt)\
        .join(Payment, Payment.payment_id == RecoveryAttempt.payment_id)\
        .filter(Payment.customer_id == customer_id)\
        .order_by(RecoveryAttempt.created_at.desc())\
        .first()
        
    recovery_data = {
        "previous_attempts": previous_attempts,
        "successful_attempts": successful_attempts,
        "failed_attempts": failed_attempts,
        "recovery_success_rate": round(recovery_success_rate, 4),
        "total_amount_recovered": round(total_recovered, 2),
        "previous_actions": previous_actions,
        "most_recent_recovery_outcome": most_recent_recovery.status if most_recent_recovery else None
    }
    
    return {
        "customer": customer_data,
        "current_transaction": current_transaction_data,
        "behavior": behavior_data,
        "recovery_history": recovery_data
    }
