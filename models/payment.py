from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime
from database.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    payment_id = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(String, nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR")

    status = Column(String(30), nullable=False)
    payment_method = Column(String(50), nullable=True)

    failure_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
