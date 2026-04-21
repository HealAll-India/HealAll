"""Custom exception classes."""


class HealAllException(Exception):
    """Base exception for HealAll application."""

    def __init__(self, code: str, message: str, details: list[dict[str, str]] | None = None):
        self.code = code
        self.message = message
        self.details = details or []
        super().__init__(message)


class ValidationException(HealAllException):
    """Validation error."""

    def __init__(self, message: str, details: list[dict[str, str]] | None = None):
        super().__init__("VALIDATION_ERROR", message, details)


class UnauthenticatedException(HealAllException):
    """Authentication required."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__("UNAUTHENTICATED", message)


class ForbiddenException(HealAllException):
    """Insufficient permissions."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__("FORBIDDEN", message)


class NotFoundException(HealAllException):
    """Resource not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__("NOT_FOUND", message)


class DuplicateException(HealAllException):
    """Duplicate resource."""

    def __init__(self, message: str):
        super().__init__("DUPLICATE", message)


class ExpiredException(HealAllException):
    """Resource expired."""

    def __init__(self, message: str):
        super().__init__("EXPIRED", message)


class RateLimitException(HealAllException):
    """Rate limit exceeded."""

    def __init__(self, message: str = "Too many requests"):
        super().__init__("RATE_LIMITED", message)


class InvalidStateException(HealAllException):
    """Invalid state transition."""

    def __init__(self, message: str):
        super().__init__("INVALID_STATE_TRANSITION", message)
