"""PII masking applied to reported content before it leaves our servers.

Deliberately over-masks: a moderator still sees the original text in-app, the
LLM only needs the shape of the content (tone, intent, solicitation) to triage.
"""

import re
from urllib.parse import urlsplit

# URLs: keep only the host so path/query tokens (reset links, invite codes,
# signed URLs) never reach the provider.
_URL_RE = re.compile(r"(?i)\b(?:https?://|www\.)[^\s<>\"'()]+")
# Bare "domain.tld/path" links (e.g. bit.ly/abc123) — path required so plain
# words like "e.g." are left alone.
_BARE_LINK_RE = re.compile(r"(?i)\b(?:[a-z0-9-]+\.)+[a-z]{2,}/[^\s<>\"'()]*")
_EMAIL_RE = re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b")
# Aadhaar-shaped: 12 digits in 4-4-4 groups, first digit 2-9.
_AADHAAR_RE = re.compile(r"(?<![\d+])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)")
# Phone candidates: digits with common separators. Counted below so dates
# (8 digits) and small numbers survive.
_PHONE_CANDIDATE_RE = re.compile(r"(?<![\w+])\+?\(?\d[\d\s().-]{5,}\d(?!\w)")
_HANDLE_RE = re.compile(r"(?<![\w@.])@[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?")


def _host_of(raw: str) -> str:
    candidate = raw if "://" in raw else f"http://{raw}"
    try:
        host = urlsplit(candidate).hostname or ""
    except ValueError:
        host = ""
    host = host.removeprefix("www.")
    return host if re.fullmatch(r"[a-z0-9.-]{1,253}", host) else "link"


def _mask_url(match: re.Match[str]) -> str:
    return f"[URL:{_host_of(match.group(0))}]"


def _mask_phone(match: re.Match[str]) -> str:
    text = match.group(0)
    digits = sum(ch.isdigit() for ch in text)
    # Indian mobiles/landlines are 10-12 digits with prefix; international
    # numbers written with "+" can be as short as 8 digits.
    if digits >= 10 or (text.startswith("+") and digits >= 8):
        return "[PHONE]"
    return text


def mask_pii(text: str) -> str:
    """Return ``text`` with emails, phone numbers, ID numbers, URLs and @handles masked."""
    if not text:
        return ""
    masked = _URL_RE.sub(_mask_url, text)
    masked = _EMAIL_RE.sub("[EMAIL]", masked)
    masked = _BARE_LINK_RE.sub(_mask_url, masked)
    masked = _AADHAAR_RE.sub("[ID_NUMBER]", masked)
    masked = _PHONE_CANDIDATE_RE.sub(_mask_phone, masked)
    masked = _HANDLE_RE.sub("[HANDLE]", masked)
    return masked
