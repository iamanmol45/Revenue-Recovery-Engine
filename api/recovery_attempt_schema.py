from pydantic import BaseModel, Field
from typing import Optional, Literal


class RecoveryAttemptResolve(BaseModel):
    status: Literal['Successful', 'Failed'] = Field(..., description="Target resolution status: 'Successful' or 'Failed'")
    amount_recovered: float = Field(0.0, ge=0.0, description="Recovered revenue amount (must be non-negative)")
