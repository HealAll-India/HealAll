"""Application constants and enums."""

from enum import Enum


class VerificationLevel(int, Enum):
    """User verification levels."""

    UNVERIFIED = 0  # Not verified
    PHONE_EMAIL_VERIFIED = 1  # Phone + email verified
    ID_VERIFIED = 2  # Government ID verified (Aadhaar)
    REQUEST_VERIFIED = 3  # Has verified help requests (deprecated - not used)


class UserRole(str, Enum):
    """User roles in the system."""

    HELP_SEEKER = "help_seeker"
    HELPER = "helper"
    CASE_VERIFIER = "case_verifier"
    CASE_OWNER = "case_owner"
    MODERATOR = "moderator"
    ADMIN = "admin"
    HEAD_ADMIN = "head_admin"


class AgeRange(str, Enum):
    """Age range options.

    HealAll is for people 18 and over. TEEN stays only so accounts made before
    that rule still load; new sign-ups and profile edits can't choose it (see
    ``reject_under_18``).
    """

    TEEN = "13-17"
    YOUNG_ADULT = "18-24"
    ADULT = "25-34"
    MIDDLE_AGED = "35-44"
    SENIOR = "45+"


MINIMUM_AGE = 18
UNDER_18_MESSAGE = "HealAll is for people 18 and over."


def reject_under_18(value: AgeRange | None) -> AgeRange | None:
    """Refuse the under-18 age range on sign-up and profile edits."""
    if value == AgeRange.TEEN:
        raise ValueError(UNDER_18_MESSAGE)
    return value


# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RATE_LIMIT_PER_HOUR = 5

# Invite Code Configuration
INVITE_CODE_PREFIX = "HEAL-"
INVITE_CODE_LENGTH = 8  # After prefix
