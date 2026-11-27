"""HealAll is for people 18 and over: sign-up and profile edits refuse 13-17."""

import pytest
from pydantic import ValidationError

from app.core.constants import UNDER_18_MESSAGE, AgeRange
from app.schemas.auth import GoogleSignupRequest, SignupRequest
from app.schemas.user import UserProfileUpdate

SIGNUP = {
    "name": "Asha Rao",
    "phone": "+919876543210",
    "email": "asha@example.com",
    "city": "Pune",
    "invite_code": "HEAL-ABCDEFGH",
    "roles": ["helper"],
}
GOOGLE_SIGNUP = {
    "invite_code": "HEAL-ABCDEFGH",
    "id_token": "x" * 20,
    "phone": "+919876543210",
    "city": "Pune",
    "roles": ["helper"],
}


@pytest.mark.parametrize("model, data", [(SignupRequest, SIGNUP), (GoogleSignupRequest, GOOGLE_SIGNUP)])
def test_signup_refuses_under_18(model, data):
    with pytest.raises(ValidationError, match=UNDER_18_MESSAGE):
        model(**data, age_range="13-17")


@pytest.mark.parametrize("model, data", [(SignupRequest, SIGNUP), (GoogleSignupRequest, GOOGLE_SIGNUP)])
@pytest.mark.parametrize("age", ["18-24", "25-34", "35-44", "45+"])
def test_signup_accepts_adults(model, data, age):
    assert model(**data, age_range=age).age_range == AgeRange(age)


def test_profile_edit_refuses_under_18():
    with pytest.raises(ValidationError, match=UNDER_18_MESSAGE):
        UserProfileUpdate(age_range="13-17")


def test_profile_edit_still_allows_leaving_age_alone():
    assert UserProfileUpdate(name="Asha Rao").age_range is None
    assert UserProfileUpdate(age_range="45+").age_range == AgeRange.SENIOR
