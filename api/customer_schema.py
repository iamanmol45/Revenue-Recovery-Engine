from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    customer_id: str
    name: Optional[str] = None
    email: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    customer_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True