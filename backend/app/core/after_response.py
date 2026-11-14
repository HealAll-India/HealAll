"""Run follow-up work (OTP and welcome emails, SMS) after a response.

FastAPI's ``BackgroundTasks`` run once the response has gone out. On AWS
Lambda the execution environment is frozen as soon as the response is
returned, so a background task stalls until the next request happens to thaw
it: an OTP could arrive minutes late, or never. There the work runs before the
response instead, which costs the provider's round trip but always delivers.
"""

import logging
import os
from collections.abc import Awaitable, Callable

from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)


def runs_on_lambda() -> bool:
    """True inside AWS Lambda, which sets this variable for every function."""
    return bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


async def after_response[**P](
    background_tasks: BackgroundTasks,
    func: Callable[P, Awaitable[object]],
    *args: P.args,
    **kwargs: P.kwargs,
) -> None:
    """Schedule ``func`` after the response, or run it now on Lambda.

    A failure never fails the request, matching a background task, whose
    errors only reach the log.
    """
    if not runs_on_lambda():
        background_tasks.add_task(func, *args, **kwargs)
        return
    try:
        await func(*args, **kwargs)
    except Exception:
        logger.exception("after_response: %s failed", getattr(func, "__name__", func))
