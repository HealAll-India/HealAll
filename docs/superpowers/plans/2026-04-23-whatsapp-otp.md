# WhatsApp OTP via Meta Cloud API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SMS OTP delivery with WhatsApp messages via Meta Cloud API (free up to 1000 conversations/month), keeping email OTP unchanged.

**Architecture:** Add `WhatsAppProvider` to the existing pluggable provider pattern in `notification_service.py`. WhatsApp takes over the `send_sms()` slot — `auth.py`, `tasks.py`, and all callers are unchanged. Provider selection auto-detects `WHATSAPP_TOKEN` at startup. SMTP stays as the email provider.

**Tech Stack:** Meta WhatsApp Cloud API v20 (httpx async HTTP), existing FastAPI + Celery stack.

---

## User Setup (do this BEFORE running tasks — takes ~10 min)

1. Go to **developers.facebook.com** → My Apps → Create App
2. App type: **Business** → name: `HealAll`
3. Add product: **WhatsApp** → click Set Up
4. WhatsApp → API Setup:
   - Copy **Temporary access token** (24h) or create a permanent System User token
   - Copy **Phone Number ID** (e.g. `123456789012345`)
5. WhatsApp → API Setup → **To** field → Add test number (your personal WhatsApp number)
   - This lets you receive test messages without template approval
6. Set these env vars (paste values here, agent will run `railway variables set`):
   ```
   WHATSAPP_TOKEN=<token>
   WHATSAPP_PHONE_NUMBER_ID=<phone_number_id>
   ```

**For permanent token** (so it doesn't expire in 24h):
- Meta Business Suite → Settings → System Users → Add → Admin
- Assign the WhatsApp app → Generate token → no expiry
- Use this token instead of the temporary one

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/app/core/config.py` | Modify | Add `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` fields |
| `backend/app/services/notification_service.py` | Modify | Add `WhatsAppProvider`, `WhatsAppSMTPProvider`; update `_select_provider()` |
| `backend/.env` | Modify | Add `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` after user provides values |
| `backend/app/api/v1/auth.py` | **No change** | Already uses `celery_send_otp_sms.delay()` |
| `backend/app/worker/tasks.py` | **No change** | Already calls `notification_service.send_sms()` |

---

## Task 1: Add WhatsApp config vars to config.py

**Files:**
- Modify: `backend/app/core/config.py` (after line 69 — SMTP block)

- [ ] **Step 1: Add vars to Settings class**

In `backend/app/core/config.py`, after the SMTP block (after line 69 `SMTP_FROM_NAME`), add:

```python
    # WhatsApp (Meta Cloud API — replaces SMS)
    WHATSAPP_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
```

- [ ] **Step 2: Verify settings load**

```bash
cd backend
.venv312/bin/python -c "from app.core.config import get_settings; s = get_settings(); print(s.WHATSAPP_TOKEN, s.WHATSAPP_PHONE_NUMBER_ID)"
```

Expected output: `None None` (no env vars set yet)

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py
git commit -m "feat: add WhatsApp config vars to Settings"
```

---

## Task 2: Add WhatsAppProvider to notification_service.py

**Files:**
- Modify: `backend/app/services/notification_service.py`

The Meta WhatsApp Cloud API endpoint:
```
POST https://graph.facebook.com/v20.0/{phone_number_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "919876543210",   # no + sign, just digits
  "type": "text",
  "text": {"body": "Your HealAll OTP is: 123456. Valid 10 min."}
}
```

- [ ] **Step 1: Add WhatsAppProvider class**

In `backend/app/services/notification_service.py`, add after the `MSG91Provider` class (after line 87) and before `SMTPProvider`:

```python
# ---------------------------------------------------------------------------
# WhatsAppProvider — Meta Cloud API (free tier: 1000 conversations/month)
# ---------------------------------------------------------------------------

class WhatsAppProvider(NotificationProvider):
    """Sends OTP via WhatsApp using Meta Cloud API; console fallback for email."""

    _API_BASE = "https://graph.facebook.com/v20.0"

    def __init__(self) -> None:
        self._token = settings.WHATSAPP_TOKEN or ""
        self._phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID or ""
        self._console = ConsoleProvider()

    async def send_sms(self, phone: str, message: str) -> bool:
        """Send message via WhatsApp. `phone` is E.164 format (+919876543210)."""
        try:
            import httpx

            url = f"{self._API_BASE}/{self._phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            }
            payload = {
                "messaging_product": "whatsapp",
                "to": phone.lstrip("+"),  # Meta wants digits only: 919876543210
                "type": "text",
                "text": {"body": message},
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                logger.info("WhatsApp message sent to %s", phone)
                return True
            logger.error(
                "WhatsApp API error: status=%s body=%s", resp.status_code, resp.text
            )
            return await self._console.send_sms(phone, message)
        except Exception:
            logger.exception("WhatsAppProvider.send_sms error; falling back to console")
            return await self._console.send_sms(phone, message)

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        return await self._console.send_email(to, subject, body)
```

- [ ] **Step 2: Add WhatsAppSMTPProvider class**

Add after `WhatsAppProvider` and before `CombinedProvider`:

```python
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
```

- [ ] **Step 3: Update _select_provider() to prefer WhatsApp over MSG91**

Replace the existing `_select_provider` function (lines 175–190) with:

```python
def _select_provider() -> NotificationProvider:
    has_whatsapp = bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)
    has_msg91 = bool(settings.MSG91_API_KEY)
    has_smtp = bool(settings.SMTP_HOST)

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
```

- [ ] **Step 4: Lint check**

```bash
cd backend && .venv312/bin/ruff check app/services/notification_service.py app/core/config.py
```

Expected: `All checks passed!`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/notification_service.py
git commit -m "feat: add WhatsApp OTP provider via Meta Cloud API"
```

---

## Task 3: Set env vars and verify end-to-end

**Prerequisite:** User has completed Meta setup and provided `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.

- [ ] **Step 1: Set in local .env**

Add to `backend/.env`:
```
WHATSAPP_TOKEN=<value from user>
WHATSAPP_PHONE_NUMBER_ID=<value from user>
```

- [ ] **Step 2: Set in Railway**

```bash
cd backend
railway variables set WHATSAPP_TOKEN=<value> WHATSAPP_PHONE_NUMBER_ID=<value>
```

- [ ] **Step 3: Verify provider selection logs on startup**

```bash
cd backend && railway logs --tail 2>&1 | grep -i "NotificationProvider"
```

Expected: `NotificationProvider: WhatsAppSMTPProvider (WhatsApp OTP + SMTP email)`

- [ ] **Step 4: Test OTP delivery manually**

With Docker running locally (`make up`):
```bash
cd backend && make dev
```

Then from another terminal:
```bash
curl -X POST http://localhost:8000/v1/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_or_email": "+91<your_number>"}'
```

Expected: WhatsApp message arrives on phone within ~5 seconds.

- [ ] **Step 5: Update ACTIVITY_LOG.md**

Append entry to `docs/ACTIVITY_LOG.md`.

---

## Verification

| Check | Command | Expected |
|-------|---------|----------|
| Lint | `ruff check app/` | All checks passed |
| Provider selection | Check startup logs | WhatsAppSMTPProvider |
| WhatsApp delivery | Call resend-otp with test number | WA message received |
| Email delivery | Signup with real email | Email OTP received |
| Test suite | `make test` (with Docker) | 108/108 pass |

---

## Notes on Meta Template Approval (production)

For production beyond the sandbox (numbers not manually added to test allowlist), Meta requires approved message templates for business-initiated messages. To submit one:

1. Meta Business Manager → WhatsApp → Message Templates → Create
2. Category: **Authentication** (pre-approved, fastest)
3. Template name: `healall_otp`
4. Language: English
5. Body: `Your HealAll verification code is {{1}}. Valid for 10 minutes.`
6. Submit — typically approved in minutes for Authentication category

Then update `WhatsAppProvider.send_sms()` to use template format:
```python
payload = {
    "messaging_product": "whatsapp",
    "to": phone.lstrip("+"),
    "type": "template",
    "template": {
        "name": "healall_otp",
        "language": {"code": "en"},
        "components": [{
            "type": "body",
            "parameters": [{"type": "text", "text": otp_code}]
        }]
    }
}
```
This requires extracting `otp_code` from the full message string — caller change needed at that point.
