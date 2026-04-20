"""Celery tasks for background processing of notifications and case events."""
import asyncio
import logging

from celery import Task

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="worker.send_otp_sms")
def send_otp_sms(self: Task, phone: str, otp_code: str, purpose: str) -> bool:
    """Send an OTP via SMS in the background.

    Args:
        phone: Recipient phone number.
        otp_code: The one-time password to send.
        purpose: Human-readable purpose label (e.g. "login", "signup").

    Returns:
        True if the SMS was dispatched successfully.
    """
    from app.services import notification_service  # local import avoids circular deps

    try:
        logger.info("Sending OTP SMS to %s for purpose=%s", phone, purpose)
        message = (
            f"Your HealAll OTP for {purpose} is: {otp_code}. "
            "Valid for 10 minutes. Do not share this code."
        )
        result: bool = asyncio.run(notification_service.send_sms(phone, message))
        return result
    except Exception as exc:
        logger.exception("send_otp_sms failed for phone=%s: %s", phone, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="worker.send_otp_email")
def send_otp_email(self: Task, email: str, otp_code: str, purpose: str) -> bool:
    """Send an OTP via email in the background.

    Args:
        email: Recipient email address.
        otp_code: The one-time password to send.
        purpose: Human-readable purpose label (e.g. "login", "signup").

    Returns:
        True if the email was dispatched successfully.
    """
    from app.services import notification_service  # local import avoids circular deps

    try:
        logger.info("Sending OTP email to %s for purpose=%s", email, purpose)
        subject = f"Your HealAll Verification Code ({purpose})"
        body = (
            f"Your HealAll verification code for {purpose} is: {otp_code}\n\n"
            "This code will expire in 10 minutes.\n\n"
            "If you did not request this code, please ignore this email.\n\n"
            "Best regards,\nHealAll Team"
        )
        result: bool = asyncio.run(notification_service.send_email(email, subject, body))
        return result
    except Exception as exc:
        logger.exception("send_otp_email failed for email=%s: %s", email, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="worker.notify_case_update")
def notify_case_update(self: Task, case_id: str, event: str, recipient_ids: list[str]) -> None:
    """Notify recipients about a case status update.

    Args:
        case_id: Identifier of the case that was updated.
        event: Description of the event (e.g. "assigned", "closed", "reopened").
        recipient_ids: List of user IDs who should receive the notification.
    """
    try:
        logger.info(
            "Case update notification: case_id=%s event=%s recipients=%s",
            case_id,
            event,
            recipient_ids,
        )
        for recipient_id in recipient_ids:
            logger.info(
                "Notifying user %s about case %s event: %s",
                recipient_id,
                case_id,
                event,
            )
        # TODO: Replace with real push/email/SMS dispatch when providers are configured.
    except Exception as exc:
        logger.exception("notify_case_update failed for case_id=%s: %s", case_id, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="worker.notify_new_comment")
def notify_new_comment(
    self: Task, post_id: str, commenter_name: str, post_author_id: str
) -> None:
    """Notify a post author that a new comment has been added.

    Args:
        post_id: Identifier of the post that received the comment.
        commenter_name: Display name of the user who commented.
        post_author_id: User ID of the post author to notify.
    """
    try:
        logger.info(
            "New comment notification: post_id=%s commenter=%s author=%s",
            post_id,
            commenter_name,
            post_author_id,
        )
        logger.info(
            "Notifying author %s that %s commented on post %s",
            post_author_id,
            commenter_name,
            post_id,
        )
        # TODO: Replace with real push/email/SMS dispatch when providers are configured.
    except Exception as exc:
        logger.exception(
            "notify_new_comment failed for post_id=%s: %s", post_id, exc
        )
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1)) from exc
