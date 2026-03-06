"""Common schemas used across the API."""
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Validation error detail."""
    field: str
    message: str


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: "ErrorInfo"


class ErrorInfo(BaseModel):
    """Error information."""
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "0.1.0"
