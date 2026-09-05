from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PaymentCreate(BaseModel):
    payment_id: str
    customer_id: str
    amount: float
    currency: str = "INR"
    status: str
    payment_method: Optional[str] = None
    failure_reason: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    payment_id: str
    customer_id: str
    amount: float
    currency: str
    status: str
    payment_method: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True