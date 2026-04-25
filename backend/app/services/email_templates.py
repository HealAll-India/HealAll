"""HTML email templates for HealAll — branded, email-client safe."""

from __future__ import annotations

import base64
import os

# ---------------------------------------------------------------------------
# Inline logo attachment (CID embedding — works in Gmail without "show images")
# ---------------------------------------------------------------------------

_LOGO_PATH = os.path.join(os.path.dirname(__file__), "healall-logo.png")
_LOGO_CID = "healall-logo"


def _load_logo_b64() -> str:
    """Load logo PNG as base64. Falls back to empty string if file not found."""
    try:
        abs_path = os.path.abspath(_LOGO_PATH)
        with open(abs_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except FileNotFoundError:
        return ""


_LOGO_B64: str = _load_logo_b64()


def get_logo_attachment() -> dict | None:
    """
    Return a Resend-compatible inline attachment dict for the HealAll logo,
    or None if the file is not available.

    Usage in Resend payload:
        "attachments": [get_logo_attachment()]
        In HTML: <img src="cid:healall-logo" ...>
    """
    if not _LOGO_B64:
        return None
    return {
        "filename": "healall-logo.png",
        "content": _LOGO_B64,
        "content_id": _LOGO_CID,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_FONT = "'DM Sans', Arial, sans-serif"
_GREEN = "#16a34a"
_DARK = "#111827"
_MUTED = "#6b7280"


def _base(hero_html: str, body_html: str, preview_text: str = "") -> str:
    """
    Wrap hero + body in the HealAll email shell.

    hero_html  — content that sits on the green/blue gradient header
    body_html  — content in the white body card
    """
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en" xmlns="http://www.w3.org/1999/xhtml">\n'
        "<head>\n"
        '  <meta charset="UTF-8" />\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
        '  <meta http-equiv="X-UA-Compatible" content="IE=edge" />\n'
        '  <meta name="color-scheme" content="light" />\n'
        '  <title>HealAll</title>\n'
        "  <style type=\"text/css\">\n"
        "    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');\n"
        "    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}\n"
        "    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}\n"
        "    body{margin:0!important;padding:0!important;background-color:#f0fdf4;width:100%!important;}\n"
        "    a{text-decoration:none;}\n"
        "    @media only screen and (max-width:620px){\n"
        "      .wrap{width:100%!important;padding:0!important;}\n"
        "      .card{width:100%!important;border-radius:0!important;}\n"
        "      .hero-pad{padding:32px 24px!important;}\n"
        "      .body-pad{padding:32px 24px!important;}\n"
        "      .foot-pad{padding:20px 24px!important;}\n"
        "      .otp-slab{padding:22px 24px!important;}\n"
        "      .otp-num{font-size:42px!important;letter-spacing:10px!important;}\n"
        "    }\n"
        "  </style>\n"
        "</head>\n"
        '<body style="margin:0;padding:0;background-color:#f0fdf4;">\n'
        "\n"
        "  <!-- preview -->\n"
        '  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0fdf4;">\n'
        f"    {preview_text}"
        "&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;\n"
        "  </div>\n"
        "\n"
        "  <!-- outer -->\n"
        '  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"\n'
        '         style="background-color:#f0fdf4;">\n'
        "    <tr>\n"
        '      <td align="center" style="padding:40px 16px 52px;" class="wrap">\n'
        "\n"
        "        <!-- card -->\n"
        '        <table role="presentation" border="0" cellpadding="0" cellspacing="0"\n'
        '               width="560" class="card"\n'
        '               style="max-width:560px;border-radius:20px;overflow:hidden;\n'
        '                      border:1px solid #bbf7d0;">\n'
        "\n"
        "          <!-- HERO -->\n"
        "          <tr>\n"
        '            <td style="background:linear-gradient(140deg,#16a34a 0%,#1d55d4 100%);\n'
        '                       padding:40px 48px 36px;" class="hero-pad">\n'
        "\n"
        "              <!-- logo (CID inline — no external URL needed) -->\n"
        '              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">\n'
        "                <tr>\n"
        '                  <td align="center" style="padding-bottom:20px;">\n'
        f'                    <img src="cid:{_LOGO_CID}"\n'
        '                         alt="HealAll"\n'
        '                         width="72" height="72"\n'
        '                         style="display:block;border:0;border-radius:16px;\n'
        '                                background:rgba(255,255,255,0.15);\n'
        '                                padding:6px;" />\n'
        "                  </td>\n"
        "                </tr>\n"
        "              </table>\n"
        "\n"
        "              <!-- hero content -->\n"
        f"              {hero_html}\n"
        "\n"
        "            </td>\n"
        "          </tr>\n"
        "\n"
        "          <!-- BODY -->\n"
        "          <tr>\n"
        '            <td style="background:#ffffff;padding:40px 48px 36px;" class="body-pad">\n'
        f"              {body_html}\n"
        "            </td>\n"
        "          </tr>\n"
        "\n"
        "          <!-- FOOTER -->\n"
        "          <tr>\n"
        '            <td style="background:#f9fafb;padding:22px 48px;\n'
        '                       border-top:1px solid #e5e7eb;" class="foot-pad">\n'
        '              <p style="margin:0 0 4px;font-family:\'DM Sans\',Arial,sans-serif;\n'
        '                        font-size:12px;color:#9ca3af;line-height:1.6;">\n'
        '                <a href="https://healallindia.com"\n'
        '                   style="color:#16a34a;font-weight:700;text-decoration:none;">healallindia.com</a>\n'
        "                &nbsp;&middot;&nbsp; India's mutual-aid community\n"
        "                &nbsp;&middot;&nbsp; Invite-only\n"
        "              </p>\n"
        '              <p style="margin:0;font-family:\'DM Sans\',Arial,sans-serif;\n'
        '                        font-size:11px;color:#d1d5db;line-height:1.5;">\n'
        "                If you didn't request this, ignore it &mdash; your account is safe.\n"
        "              </p>\n"
        "            </td>\n"
        "          </tr>\n"
        "\n"
        "        </table>\n"
        "      </td>\n"
        "    </tr>\n"
        "  </table>\n"
        "\n"
        "</body>\n"
        "</html>"
    )


# ---------------------------------------------------------------------------
# OTP email
# ---------------------------------------------------------------------------

def otp_email(otp_code: str, purpose: str) -> tuple[str, str]:
    """Returns (subject, html_body) for an OTP email."""
    purpose_label = {
        "signup": "account verification",
        "login": "login",
        "verification": "verification",
    }.get(purpose, purpose)

    subject = f"{otp_code} is your HealAll code"

    hero = (
        f'<h1 style="margin:0;font-family:\'DM Sans\',Arial,sans-serif;'
        f'font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">'
        f"Verify your {purpose_label}"
        f"</h1>"
        f'<p style="margin:8px 0 0;font-family:\'DM Sans\',Arial,sans-serif;'
        f'font-size:15px;color:rgba(255,255,255,0.82);line-height:1.6;">'
        f"Use the code below &mdash; it expires in&nbsp;<strong>10&nbsp;minutes</strong>."
        f"</p>"
    )

    body = (
        # ── OTP slab ──
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">\n'
        "  <tr>\n"
        '    <td align="center" style="padding-bottom:32px;">\n'
        '      <table role="presentation" border="0" cellpadding="0" cellspacing="0">\n'
        "        <tr>\n"
        '          <td align="center" class="otp-slab"\n'
        '              style="background:#111827;border-radius:16px;padding:28px 44px 24px;">\n'
        f'            <span class="otp-num"\n'
        f'                  style="font-family:\'DM Sans\',Courier,monospace;'
        f'font-size:56px;font-weight:800;letter-spacing:16px;'
        f'color:#ffffff;display:block;line-height:1;text-align:center;">'
        f"{otp_code}"
        f"</span>\n"
        f'            <span style="font-family:\'DM Sans\',Arial,sans-serif;'
        f'font-size:11px;font-weight:700;color:#6b7280;'
        f'text-transform:uppercase;letter-spacing:0.12em;'
        f'display:block;margin-top:12px;text-align:center;">'
        f"One-time password"
        f"</span>\n"
        "          </td>\n"
        "        </tr>\n"
        "      </table>\n"
        "    </td>\n"
        "  </tr>\n"
        "</table>\n"

        # ── Expiry row ──
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"'
        '       style="margin-bottom:12px;">\n'
        "  <tr>\n"
        '    <td style="background:#f9fafb;border-radius:10px;padding:14px 18px;">\n'
        '      <table role="presentation" border="0" cellpadding="0" cellspacing="0">\n'
        "        <tr>\n"
        '          <td style="font-size:20px;padding-right:12px;vertical-align:middle;">⏱</td>\n'
        "          <td style=\"vertical-align:middle;\">\n"
        '            <span style="font-family:\'DM Sans\',Arial,sans-serif;'
        'font-size:14px;font-weight:600;color:#374151;">Expires in 10 minutes</span>\n'
        '            <span style="font-family:\'DM Sans\',Arial,sans-serif;'
        'font-size:13px;color:#9ca3af;display:block;margin-top:2px;">'
        'Request a new code from the app if it expires.</span>\n'
        "          </td>\n"
        "        </tr>\n"
        "      </table>\n"
        "    </td>\n"
        "  </tr>\n"
        "</table>\n"

        # ── Security row ──
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">\n'
        "  <tr>\n"
        '    <td style="background:#fff7ed;border-left:3px solid #f97316;'
        'border-radius:0 10px 10px 0;padding:14px 18px;">\n'
        '      <table role="presentation" border="0" cellpadding="0" cellspacing="0">\n'
        "        <tr>\n"
        '          <td style="font-size:20px;padding-right:12px;vertical-align:middle;">🔒</td>\n'
        "          <td style=\"vertical-align:middle;\">\n"
        '            <span style="font-family:\'DM Sans\',Arial,sans-serif;'
        'font-size:14px;font-weight:700;color:#92400e;">Never share this code</span>\n'
        '            <span style="font-family:\'DM Sans\',Arial,sans-serif;'
        'font-size:13px;color:#b45309;display:block;margin-top:2px;">'
        'HealAll will never ask for your OTP over phone or chat.</span>\n'
        "          </td>\n"
        "        </tr>\n"
        "      </table>\n"
        "    </td>\n"
        "  </tr>\n"
        "</table>\n"
    )

    preview = f"Your HealAll code is {otp_code} — valid for 10 minutes. Do not share it."
    return subject, _base(hero, body, preview)


# ---------------------------------------------------------------------------
# Welcome email
# ---------------------------------------------------------------------------

def welcome_email(name: str) -> tuple[str, str]:
    """Returns (subject, html_body) for a post-signup welcome email."""
    first = name.split()[0] if name else "there"
    subject = f"Welcome to HealAll, {first}! 🤝"

    hero = (
        f'<h1 style="margin:0;font-family:\'DM Sans\',Arial,sans-serif;'
        f'font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">'
        f"You're in, {first}!"
        f"</h1>"
        f'<p style="margin:8px 0 0;font-family:\'DM Sans\',Arial,sans-serif;'
        f'font-size:15px;color:rgba(255,255,255,0.82);line-height:1.6;">'
        f"Welcome to India's mutual-aid community."
        f"</p>"
    )

    def _step(bg: str, color: str, icon: str, title: str, desc: str) -> str:
        return (
            '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">\n'
            "  <tr>\n"
            f'    <td style="background:{bg};border-radius:12px;padding:16px 20px;">\n'
            f'      <span style="font-family:\'DM Sans\',Arial,sans-serif;font-size:14px;'
            f'font-weight:700;color:{color};display:block;margin-bottom:3px;">'
            f"{icon}&nbsp; {title}</span>\n"
            f'      <span style="font-family:\'DM Sans\',Arial,sans-serif;font-size:13px;'
            f'color:#6b7280;line-height:1.6;display:block;">{desc}</span>\n'
            "    </td>\n"
            "  </tr>\n"
            "</table>\n"
        )

    body = (
        '<p style="margin:0 0 24px;font-family:\'DM Sans\',Arial,sans-serif;'
        'font-size:15px;color:#374151;line-height:1.7;">'
        "HealAll is built on trust, respect, and the belief that communities"
        " can take care of their own. Here&rsquo;s how to get started:"
        "</p>\n"

        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"'
        '       style="margin-bottom:28px;">\n'
        "  <tr><td style=\"padding-bottom:10px;\">"
        + _step("#f0fdf4", "#15803d", "🧑‍💼", "Complete your profile",
                "Add skills and availability so the community knows how you can help.")
        + "</td></tr>\n"
        "  <tr><td style=\"padding-bottom:10px;\">"
        + _step("#eff6ff", "#1d4ed8", "🗺️", "Browse help requests",
                "See what your community needs — medicine, shelter, food, finance.")
        + "</td></tr>\n"
        "  <tr><td>"
        + _step("#faf5ff", "#7c3aed", "🪪", "Verify your identity",
                "Aadhaar verification unlocks all features and builds community trust.")
        + "</td></tr>\n"
        "</table>\n"

        # CTA button
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">\n'
        "  <tr>\n"
        '    <td align="center">\n'
        '      <table role="presentation" border="0" cellpadding="0" cellspacing="0">\n'
        "        <tr>\n"
        '          <td style="background:linear-gradient(135deg,#16a34a 0%,#1d55d4 100%);\n'
        '                     border-radius:9999px;">\n'
        '            <a href="https://healallindia.com/feed"\n'
        '               style="display:inline-block;font-family:\'DM Sans\',Arial,sans-serif;\n'
        '                      font-size:15px;font-weight:700;color:#ffffff;\n'
        '                      padding:14px 36px;border-radius:9999px;text-decoration:none;\n'
        '                      white-space:nowrap;">Go to Feed &rarr;</a>\n'
        "          </td>\n"
        "        </tr>\n"
        "      </table>\n"
        "    </td>\n"
        "  </tr>\n"
        "</table>\n"
    )

    preview = f"Welcome to HealAll, {first}! You're now part of India's mutual-aid community."
    return subject, _base(hero, body, preview)
