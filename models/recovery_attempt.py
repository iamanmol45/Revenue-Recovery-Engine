from sqlalchemy import Column, Integer, String, Numeric, DateTime
from datetime import datetime

from database.base import Base


class RecoveryAttempt(Base):
    __tablename__ = "recovery_attempts"

    id = Column(Integer, primary_key=True, index=True)

    payment_id = Column(String, nullable=False, index=True)

    action = Column(String(100), nullable=False)

    status = Column(String(30), nullable=False, default="Pending")

    amount_at_risk = Column(Numeric(15, 2), nullable=True)

    amount_recovered = Column(Numeric(15, 2), nullable=True, default=0)

    attempt_number = Column(Integer, nullable=False, default=1)

    reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    completed_at = Column(DateTime, nullable=True)