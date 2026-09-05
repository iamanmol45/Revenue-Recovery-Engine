from sqlalchemy import Column, Integer, String, Numeric, Float, DateTime
from database.base import Base


class RecoveryPrediction(Base):
    __tablename__ = "recovery_predictions"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String, nullable=False, index=True)
    customer_id = Column(String, nullable=True, index=True)
    failure_probability = Column(Float, nullable=False)
    revenue_at_risk = Column(Numeric(15, 2), nullable=False)
    recovery_priority = Column(String(30), nullable=False)
    recovery_action = Column(String(100), nullable=False)
    estimated_recovery_rate = Column(Float, nullable=True)
    estimated_recoverable_revenue = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, nullable=True)