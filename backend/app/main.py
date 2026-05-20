"""FastAPI application factory and configuration."""

import logging

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.exceptions import (
    DuplicateException,
    ExpiredException,
    ForbiddenException,
    HealAllException,
    InvalidStateException,
    NotFoundException,
    RateLimitException,
    UnauthenticatedException,
    ValidationException,
)
from app.core.limiter import limiter
from app.schemas.common import ErrorInfo, ErrorResponse, HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

settings = get_settings()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            traces_sample_rate=0.1,
            send_default_pii=False,
        )

    app = FastAPI(
        title="HealAll API",
        description="Backend API for the HealAll mutual-aid platform",
        version="0.1.0",
        docs_url="/docs" if settings.APP_DEBUG else None,
        redoc_url="/redoc" if settings.APP_DEBUG else None,
    )

    # Rate limiter state and middleware
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.APP_ALLOWED_ORIGINS,
        allow_origin_regex=settings.APP_ALLOWED_ORIGIN_REGEX or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(v1_router)

    # Prometheus metrics — /metrics (scrape endpoint for Prometheus)
    if settings.METRICS_ENABLED:
        Instrumentator(
            should_group_status_codes=False,
            should_ignore_untemplated=True,
            excluded_handlers=["/health", "/metrics"],
        ).instrument(app).expose(app, include_in_schema=False)

    # Health check endpoint
    @app.get("/health", response_model=HealthResponse, tags=["health"])
    async def health_check() -> HealthResponse:
        """Health check endpoint."""
        return HealthResponse(status="healthy", version="0.1.0")

    # Exception handlers
    @app.exception_handler(HealAllException)
    async def healall_exception_handler(request: Request, exc: HealAllException) -> JSONResponse:
        """Handle custom HealAll exceptions."""
        if isinstance(exc, NotFoundException):
            status_code = status.HTTP_404_NOT_FOUND
        elif isinstance(exc, ForbiddenException):
            status_code = status.HTTP_403_FORBIDDEN
        elif isinstance(exc, UnauthenticatedException):
            status_code = status.HTTP_401_UNAUTHORIZED
        elif isinstance(exc, (DuplicateException,)):
            status_code = status.HTTP_409_CONFLICT
        elif isinstance(exc, ExpiredException):
            status_code = status.HTTP_410_GONE
        elif isinstance(exc, RateLimitException):
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        elif isinstance(exc, InvalidStateException):
            status_code = status.HTTP_409_CONFLICT
        elif isinstance(exc, ValidationException):
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        else:
            status_code = status.HTTP_400_BAD_REQUEST

        return JSONResponse(
            status_code=status_code,
            content=ErrorResponse(
                error=ErrorInfo(
                    code=exc.code,
                    message=exc.message,
                    details=exc.details,
                )
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Handle Pydantic validation errors."""
        details = [{"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]} for err in exc.errors()]

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                error=ErrorInfo(
                    code="VALIDATION_ERROR",
                    message="Request validation failed",
                    details=details,
                )
            ).model_dump(),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Handle FastAPI HTTP exceptions."""
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=ErrorInfo(
                    code="HTTP_ERROR",
                    message=exc.detail,
                )
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected exceptions."""
        logging.error(f"Unexpected error: {exc}", exc_info=True)

        # Don't expose internal errors in production
        message = str(exc) if settings.APP_DEBUG else "An unexpected error occurred"

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error=ErrorInfo(
                    code="INTERNAL_ERROR",
                    message=message,
                )
            ).model_dump(),
        )

    return app


app = create_app()
