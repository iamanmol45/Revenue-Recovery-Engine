from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import get_db
from models.customer import Customer
from models.payment import Payment
from models.recovery import RecoveryPrediction
from api.customer_schema import CustomerCreate, CustomerResponse
from api.payment_schema import PaymentCreate, PaymentResponse
from api.recovery_attempt_schema import RecoveryAttemptResolve
from agents.recovery_agent import analyze_payment
from agents.tools import (
    create_recovery_attempt,
    get_recovery_attempts,
    get_payment_recovery_attempts,
    resolve_recovery_attempt
)
from api.chat_schema import ChatRequest, ChatResponse
from agents.chat_agent import handle_chat_message

app = FastAPI(
    title="RazorPay Integration API",
    description="API services for RazorPay integration and analytics",
    version="1.0.0"
)

# CORS Middleware Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the RazorPay Integration API",
        "docs_url": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/customers")
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.customer_id == customer.customer_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Customer ID '{customer.customer_id}' already exists."
        )

    try:
        new_customer = Customer(
            customer_id=customer.customer_id,
            name=customer.name,
            email=customer.email
        )

        db.add(new_customer)
        db.commit()
        db.refresh(new_customer)

        return {
            "message": "Customer created successfully",
            "customer_id": new_customer.customer_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/customers", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).all()
    return customers


@app.post("/payments")
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    existing_payment = db.query(Payment).filter(Payment.payment_id == payment.payment_id).first()
    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail=f"Payment ID '{payment.payment_id}' already exists in database."
        )

    try:
        new_payment = Payment(
            payment_id=payment.payment_id,
            customer_id=payment.customer_id,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status,
            payment_method=payment.payment_method,
            failure_reason=payment.failure_reason
        )

        db.add(new_payment)
        db.commit()
        db.refresh(new_payment)

        return {
            "message": "Payment recorded successfully",
            "payment_id": new_payment.payment_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record payment in database: {str(e)}")



@app.get("/payments", response_model=List[PaymentResponse])
def get_payments(db: Session = Depends(get_db)):
    payments = db.query(Payment).all()
    return payments


@app.get("/analytics/overview")
def get_overview(db: Session = Depends(get_db)):
    """
    Aggregated recovery metrics for the Overview dashboard.
    Uses combined SQL aggregations (2 queries instead of 6) for fast response
    across 170,000+ recovery_predictions rows.
    """

    # Single combined aggregation for totals
    totals = db.query(
        func.count(RecoveryPrediction.id),
        func.sum(RecoveryPrediction.revenue_at_risk),
        func.sum(RecoveryPrediction.estimated_recoverable_revenue)
    ).first()

    total_transactions = totals[0] or 0
    total_revenue_at_risk = float(totals[1] or 0)
    estimated_recoverable = float(totals[2] or 0)

    # Single GROUP BY for all priority counts
    priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    priority_rows = (
        db.query(
            RecoveryPrediction.recovery_priority,
            func.count(RecoveryPrediction.id)
        )
        .group_by(RecoveryPrediction.recovery_priority)
        .all()
    )
    for priority, count in priority_rows:
        if priority:
            key = str(priority).lower()
            if key in priority_counts:
                priority_counts[key] = count

    return {
        "total_transactions": total_transactions,
        "revenue_at_risk": total_revenue_at_risk,
        "estimated_recoverable_revenue": estimated_recoverable,
        "priority_counts": priority_counts
    }


@app.get("/analytics/recovery-queue")
def get_recovery_queue(
    limit: int = 20,
    db: Session = Depends(get_db)
):

    transactions = db.query(
        RecoveryPrediction
    ).order_by(
        RecoveryPrediction.revenue_at_risk.desc()
    ).limit(limit).all()

    return [
        {
            "payment_id": row.payment_id,
            "customer_id": row.customer_id,
            "failure_probability": row.failure_probability,
            "revenue_at_risk": float(row.revenue_at_risk),
            "recovery_priority": row.recovery_priority,
            "recovery_action": row.recovery_action,
            "estimated_recovery_rate": row.estimated_recovery_rate,
            "estimated_recoverable_revenue": (
                float(row.estimated_recoverable_revenue)
                if row.estimated_recoverable_revenue is not None
                else 0
            )
        }
        for row in transactions
    ]


@app.get("/analytics/trend")
def get_recovery_trend(db: Session = Depends(get_db)):
    from sqlalchemy import cast, Date
    
    results = db.query(
        cast(RecoveryPrediction.created_at, Date).label('date'),
        func.sum(RecoveryPrediction.revenue_at_risk).label('revenue_at_risk'),
        func.sum(RecoveryPrediction.estimated_recoverable_revenue).label('estimated_recoverable')
    ).filter(
        RecoveryPrediction.created_at.isnot(None)
    ).group_by(
        cast(RecoveryPrediction.created_at, Date)
    ).order_by(
        cast(RecoveryPrediction.created_at, Date).asc()
    ).all()
    
    trend_data = [
        {
            "date": str(date),
            "revenue_at_risk": float(revenue_at_risk or 0),
            "estimated_recoverable_revenue": float(recoverable or 0)
        }
        for date, revenue_at_risk, recoverable in results
    ]
    
    return {
        "success": True,
        "trend": trend_data
    }


@app.get("/analytics/priorities")
def get_priorities(db: Session = Depends(get_db)):

    results = db.query(
        RecoveryPrediction.recovery_priority,
        func.count(RecoveryPrediction.id),
        func.sum(RecoveryPrediction.revenue_at_risk),
        func.sum(RecoveryPrediction.estimated_recoverable_revenue)
    ).group_by(
        RecoveryPrediction.recovery_priority
    ).all()

    return [
        {
            "priority": priority,
            "transaction_count": count,
            "revenue_at_risk": float(revenue_at_risk or 0),
            "estimated_recoverable": float(recoverable or 0)
        }
        for priority, count, revenue_at_risk, recoverable in results
    ]


@app.get("/agent/analyze/{payment_id}")
@app.get("/analytics/analyze/{payment_id}")
def analyze_payment_endpoint(
    payment_id: str,
    db: Session = Depends(get_db)
):
    return analyze_payment(db, payment_id)


@app.post("/analytics/recover/{payment_id}")
@app.post("/analytics/initiate-recovery/{payment_id}")
def initiate_recovery_endpoint(
    payment_id: str,
    db: Session = Depends(get_db)
):
    return create_recovery_attempt(db, payment_id)


@app.get("/analytics/recovery-attempts")
def get_recovery_attempts_endpoint(
    status: Optional[str] = None,
    action: Optional[str] = None,
    payment_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_recovery_attempts(db, status=status, action=action, payment_id=payment_id)


@app.get("/analytics/recovery-attempts/{payment_id}")
def get_payment_recovery_attempts_endpoint(
    payment_id: str,
    db: Session = Depends(get_db)
):
    return get_payment_recovery_attempts(db, payment_id=payment_id)


@app.patch("/analytics/recovery-attempts/{attempt_id}")
def resolve_recovery_attempt_endpoint(
    attempt_id: int,
    body: RecoveryAttemptResolve,
    db: Session = Depends(get_db)
):
    res = resolve_recovery_attempt(
        db,
        attempt_id=attempt_id,
        status=body.status,
        amount_recovered=body.amount_recovered
    )
    if not res.get("success"):
        error_type = res.get("error_type")
        if error_type == "not_found":
            raise HTTPException(status_code=404, detail=res.get("message"))
        else:
            raise HTTPException(status_code=400, detail=res.get("message"))

    return res

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Handles chatbot messages, routing them to the database or LLM as needed.
    """
    try:
        response_dict = handle_chat_message(request.message, db)
        return ChatResponse(
            answer=response_dict["answer"],
            source=response_dict["source"]
        )
    except Exception as e:
        # Don't leak raw errors to user
        return ChatResponse(
            answer="I'm unable to connect to the Revenue Assistant right now. Please try again.",
            source="error"
        )