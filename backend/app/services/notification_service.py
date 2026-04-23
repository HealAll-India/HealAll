"""Notification service for SMS and email — pluggable provider pattern."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.text import MIMEText

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class NotificationProvider(ABC):
    """Abstract base for all notification providers."""

    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> bool:
        """Send an SMS message. Returns True on success."""

    @abstractmethod
    async def send_email(self, to: str, subject: str, body: str) -> bool:
        """Send an email. Returns True on success."""


# ---------------------------------------------------------------------------
# ConsoleProvider — default for development
# ---------------------------------------------------------------------------


class ConsoleProvider(NotificationProvider):
    """Logs notifications to the console instead of sending them."""

    async def send_sms(self, phone: str, message: str) -> bool:
        logger.info("[CONSOLE SMS] To: %s | Message: %s", phone, message)
        return True

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        logger.info("[CONSOLE EMAIL] To: %s | Subject: %s | Body: %s", to, subject, body)
        return True


# ---------------------------------------------------------------------------
# MSG91Provider — real SMS via MSG91 HTTP API, console fallback for email
# ---------------------------------------------------------------------------


class MSG91Provider(NotificationProvider):
    """Sends SMS via MSG91; falls back to console for email."""

    def __init__(self) -> None:
        self._api_key = settings.MSG91_API_KEY or ""
        self._sender_id = settings.MSG91_SENDER_ID or "HEALLL"
        self._template_id = settings.MSG91_TEMPLATE_ID_OTP or ""
        self._console = ConsoleProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        try:
            import httpx  # already a project dep (in dev extras, added to main below)

            # MSG91 Send OTP API v5
            url = "https://control.msg91.com/api/v5/otp"
            params = {
                "template_id": self._template_id,
                "mobile": phone.lstrip("+"),
                "authkey": self._api_key,
                "otp": message,  # callers pass the full message; OTP extraction handled by template
            }
            headers = {"Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, params=params, headers=headers)
                if resp.status_code == 200:
                    logger.info("MSG91 SMS sent to %s", phone)
                    return True
                logger.error("MSG91 SMS failed: status=%s body=%s", resp.status_code, resp.text)
                return False
        except Exception:
            logger.exception("MSG91Provider.send_sms error; falling back to console")
            return await self._console.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        logger.info("MSG91Provider has no email capability; using console fallback")
        return await self._console.send_email(to, subject, body)


# ---------------------------------------------------------------------------
# WhatsAppProvider — Meta Cloud API (free tier: 1000 conversations/month)
# ---------------------------------------------------------------------------


class WhatsAppProvider(NotificationProvider):
    """Sends OTP via WhatsApp using Meta Cloud API; console fallback for email."""

    _API_BASE = "https://graph.facebook.com/v20.0"

    def __init__(self) -> None:
        self._token = settings.WHATSAPP_TOKEN or ""
        self._phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID or ""
        self._template_name = settings.WHATSAPP_OTP_TEMPLATE_NAME or ""
        self._console = ConsoleProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        """Send message via WhatsApp. `phone` is E.164 format (+919876543210)."""
        try:
            import re

            import httpx

            url = f"{self._API_BASE}/{self._phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            }

            if self._template_name:
                # Production: use approved template (required for unsolicited messages)
                otp_match = re.search(r"\b(\d+)\b", message)
                otp_value = otp_match.group(1) if otp_match else message
                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone.lstrip("+"),
                    "type": "template",
                    "template": {
                        "name": self._template_name,
                        "language": {"code": "en"},
                        "components": [
                            {
                                "type": "body",
                                "parameters": [{"type": "text", "text": otp_value}],
                            }
                        ],
                    },
                }
            else:
                # Sandbox/test: text messages work for manually added test numbers
                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone.lstrip("+"),
                    "type": "text",
                    "text": {"body": message},
                }

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    logger.info("WhatsApp message sent to %s", phone)
                    return True
                logger.error("WhatsApp API error: status=%s body=%s", resp.status_code, resp.text)
                return False
        except Exception:
            logger.exception("WhatsAppProvider.send_sms error; falling back to console")
            return await self._console.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        logger.info("WhatsAppProvider has no email capability; using console fallback")
        return await self._console.send_email(to, subject, body)


# ---------------------------------------------------------------------------
# SMTPProvider — real email via SMTP, console fallback for SMS
# ---------------------------------------------------------------------------


class SMTPProvider(NotificationProvider):
    """Sends email via SMTP; falls back to console for SMS."""

    def __init__(self) -> None:
        self._host = settings.SMTP_HOST or ""
        self._port = settings.SMTP_PORT or 587
        self._user = settings.SMTP_USER or ""
        self._password = settings.SMTP_PASSWORD or ""
        self._from_email = settings.SMTP_FROM_EMAIL or "noreply@healall.in"
        self._from_name = settings.SMTP_FROM_NAME or "HealAll"
        self._console = ConsoleProvider()

    def _build_message(self, to: str, subject: str, body: str) -> MIMEText:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = f"{self._from_name} <{self._from_email}>"
        msg["To"] = to
        return msg

    def _send_sync(self, to: str, subject: str, body: str) -> bool:
        """Blocking SMTP send — run inside a thread pool."""
        msg = self._build_message(to, subject, body)
        with smtplib.SMTP(self._host, self._port) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(self._user, self._password)
            smtp.sendmail(self._from_email, [to], msg.as_string())
        return True

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        try:
            # Try aiosmtplib first (optional dep); fall back to smtplib in thread
            try:
                import aiosmtplib  # type: ignore[import]

                msg = self._build_message(to, subject, body)
                await aiosmtplib.send(
                    msg,
                    hostname=self._host,
                    port=self._port,
                    username=self._user,
                    password=self._password,
                    start_tls=True,
                )
                logger.info("SMTP email sent to %s via aiosmtplib", to)
                return True
            except ImportError:
                result: bool = await asyncio.to_thread(self._send_sync, to, subject, body)
                logger.info("SMTP email sent to %s via smtplib thread", to)
                return result
        except Exception:
            logger.exception("SMTPProvider.send_email error; falling back to console")
            return await self._console.send_email(to, subject, body)

    async def send_sms(self, phone: str, message: str) -> bool:
        logger.info("SMTPProvider has no SMS capability; using console fallback")
        return await self._console.send_sms(phone, message)


# ---------------------------------------------------------------------------
# ResendProvider — email via Resend HTTPS API (works on Railway, no port block)
# ---------------------------------------------------------------------------


class ResendProvider(NotificationProvider):
    """Sends email via Resend API (HTTPS/443); falls back to console for SMS."""

    def __init__(self) -> None:
        self._api_key = settings.RESEND_API_KEY or ""
        self._from_email = settings.SMTP_FROM_EMAIL or "noreply@healall.in"
        self._from_name = settings.SMTP_FROM_NAME or "HealAll"
        self._console = ConsoleProvider()

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "from": f"{self._from_name} <{self._from_email}>",
                "to": [to],
                "subject": subject,
                "text": body,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post("https://api.resend.com/emails", headers=headers, json=payload)
                if resp.status_code in (200, 201):
                    logger.info("Resend email sent to %s", to)
                    return True
                logger.error("Resend email failed: status=%s body=%s", resp.status_code, resp.text)
                return False
        except Exception:
            logger.exception("ResendProvider.send_email error; falling back to console")
            return await self._console.send_email(to, subject, body)

    async def send_sms(self, phone: str, message: str) -> bool:
        logger.info("ResendProvider has no SMS capability; using console fallback")
        return await self._console.send_sms(phone, message)


# ---------------------------------------------------------------------------
# WhatsAppSMTPProvider — WhatsApp for OTP + SMTP for email
# ---------------------------------------------------------------------------


class WhatsAppSMTPProvider(NotificationProvider):
    """Delegates SMS/OTP to WhatsAppProvider and email to SMTPProvider."""

    def __init__(self) -> None:
        self._whatsapp = WhatsAppProvider()
        self._email = SMTPProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        return await self._whatsapp.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        return await self._email.send_email(to, subject, body)


# ---------------------------------------------------------------------------
# CombinedProvider — MSG91 for SMS + SMTP for email
# ---------------------------------------------------------------------------


class CombinedProvider(NotificationProvider):
    """Delegates SMS to MSG91Provider and email to SMTPProvider."""

    def __init__(self) -> None:
        self._sms = MSG91Provider()
        self._email = SMTPProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        return await self._sms.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        return await self._email.send_email(to, subject, body)


# ---------------------------------------------------------------------------
# MSG91ResendProvider — MSG91 for SMS + Resend for email
# ---------------------------------------------------------------------------


class MSG91ResendProvider(NotificationProvider):
    """Delegates SMS to MSG91Provider and email to ResendProvider."""

    def __init__(self) -> None:
        self._sms = MSG91Provider()
        self._email = ResendProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        return await self._sms.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        return await self._email.send_email(to, subject, body)


# ---------------------------------------------------------------------------
# Provider selection (at module-load time)
# ---------------------------------------------------------------------------


def _select_provider() -> NotificationProvider:
    has_resend = bool(settings.RESEND_API_KEY)
    has_whatsapp = bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)
    has_msg91 = bool(settings.MSG91_API_KEY)
    has_smtp = bool(settings.SMTP_HOST)

    # Resend preferred over SMTP (Railway blocks SMTP ports 25/465/587)
    if has_msg91 and has_resend:
        logger.info("NotificationProvider: MSG91ResendProvider (MSG91 SMS + Resend email)")
        return MSG91ResendProvider()
    if has_resend:
        logger.info("NotificationProvider: ResendProvider (Resend email, SMS console)")
        return ResendProvider()
    if has_whatsapp and has_smtp:
        logger.info("NotificationProvider: WhatsAppSMTPProvider (WhatsApp OTP + SMTP email)")
        return WhatsAppSMTPProvider()
    if has_whatsapp:
        logger.info("NotificationProvider: WhatsAppProvider (WhatsApp OTP, email console)")
        return WhatsAppProvider()
    if has_msg91 and has_smtp:
        logger.info("NotificationProvider: CombinedProvider (MSG91 + SMTP)")
        return CombinedProvider()
    if has_msg91:
        logger.info("NotificationProvider: MSG91Provider (SMS real, email console)")
        return MSG91Provider()
    if has_smtp:
        logger.info("NotificationProvider: SMTPProvider (email real, SMS console)")
        return SMTPProvider()

    logger.info("NotificationProvider: ConsoleProvider (development stub)")
    return ConsoleProvider()


_provider: NotificationProvider = _select_provider()


# ---------------------------------------------------------------------------
# Public interface — unchanged signatures; all callers continue to work
# ---------------------------------------------------------------------------


async def send_sms(phone: str, message: str) -> bool:
    """Send an SMS message via the configured provider."""
    return await _provider.send_sms(phone, message)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via the configured provider."""
    return await _provider.send_email(to, subject, body)


async def send_otp_sms(phone: str, otp_code: str, purpose: str = "verification") -> None:
    """Send an OTP via SMS.

    Matches the interface expected by auth.py and tasks.py callers.
    ``purpose`` defaults to 'verification' so existing 2-arg call sites continue to work.
    """
    message = f"Your HealAll OTP for {purpose} is: {otp_code}. Valid for 10 minutes. Do not share this code."
    await _provider.send_sms(phone, message)


async def send_otp_email(email: str, otp_code: str, purpose: str = "verification") -> None:
    """Send an OTP via email.

    ``purpose`` defaults to 'verification' so existing 2-arg call sites continue to work.
    """
    subject = f"Your HealAll Verification Code ({purpose})"
    body = (
        f"Your HealAll verification code for {purpose} is: {otp_code}\n\n"
        "This code will expire in 10 minutes.\n\n"
        "If you did not request this code, please ignore this email.\n\n"
        "Best regards,\nHealAll Team"
    )
    await _provider.send_email(email, subject, body)


async def send_welcome_email(email: str, name: str) -> bool:
    """Send a welcome email after successful signup."""
    subject = "Welcome to HealAll!"
    body = (
        f"Hello {name},\n\n"
        "Welcome to HealAll! We're excited to have you join our community of helpers and help-seekers.\n\n"
        "Here's what you can do next:\n"
        "1. Complete your profile by adding your skills and availability\n"
        "2. Verify your identity (Aadhaar) to unlock all features\n"
        "3. Start browsing help requests or post your own\n\n"
        "Remember: HealAll is built on trust, respect, and mutual support. "
        "Please read our Community Guidelines.\n\n"
        "Best regards,\nHealAll Team"
    )
    return await _provider.send_email(email, subject, body)
