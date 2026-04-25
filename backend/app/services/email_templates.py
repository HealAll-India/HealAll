"""HTML email templates for HealAll — matches brand design system exactly."""

from __future__ import annotations


def _base(content: str, preview_text: str = "") -> str:
    """Wrap content in the HealAll base email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>HealAll</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    body {{ margin: 0; padding: 0; background-color: #f3f4f6; }}
    .email-body {{ background-color: #f3f4f6; margin: 0; padding: 0; width: 100%; }}
    @media only screen and (max-width: 600px) {{
      .email-container {{ width: 100% !important; }}
      .email-padding {{ padding: 24px 16px !important; }}
      .otp-code {{ font-size: 36px !important; letter-spacing: 10px !important; }}
    }}
  </style>
</head>
<body class="email-body">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    {preview_text}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-body">
    <tr>
      <td align="center" style="padding: 40px 20px;" class="email-padding">

        <!-- Email card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" class="email-container"
               style="max-width:560px; background:#ffffff; border-radius:20px;
                      box-shadow:0 2px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
                      overflow:hidden;">

          <!-- Brand gradient top bar -->
          <tr>
            <td style="height:4px; background:linear-gradient(90deg,#16a34a 0%,#2563eb 100%); font-size:0; line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #f3f4f6;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Logo mark: green heart + blue circle -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align:middle; padding-right:10px;">
                          <!-- SVG heart icon inline -->
                          <div style="width:38px;height:38px;border-radius:10px;
                                      background:linear-gradient(135deg,#dcfce7,#dbeafe);
                                      display:flex;align-items:center;justify-content:center;
                                      font-size:20px;text-align:center;line-height:38px;">
                            🤝
                          </div>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:'DM Sans',Arial,sans-serif;
                                       font-size:20px;font-weight:800;
                                       background:linear-gradient(135deg,#16a34a,#2563eb);
                                       -webkit-background-clip:text;
                                       -webkit-text-fill-color:transparent;
                                       color:#16a34a;">HealAll</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding: 36px 40px 32px;">
              {content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background:#fafffe;
                       border-top: 1px solid #f0fdf4; border-radius:0 0 20px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0; font-family:'DM Sans',Arial,sans-serif;
                               font-size:11px; color:#9ca3af; line-height:1.6;">
                      <a href="https://healallindia.com" style="color:#16a34a; text-decoration:none; font-weight:600;">healallindia.com</a>
                      &nbsp;·&nbsp; India's mutual-aid community
                      &nbsp;·&nbsp; Invite-only platform
                    </p>
                    <p style="margin:6px 0 0; font-family:'DM Sans',Arial,sans-serif;
                               font-size:11px; color:#d1d5db;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>
</body>
</html>"""


def otp_email(otp_code: str, purpose: str) -> tuple[str, str]:
    """
    Returns (subject, html_body) for an OTP email.

    purpose: 'signup' | 'login' | 'verification'
    """
    purpose_label = {
        "signup": "account verification",
        "login": "login",
        "verification": "verification",
    }.get(purpose, purpose)

    subject = f"Your HealAll verification code — {otp_code}"

    content = f"""
      <!-- Greeting -->
      <p style="margin:0 0 6px; font-family:'DM Sans',Arial,sans-serif;
                font-size:13px; font-weight:700; color:#9ca3af;
                text-transform:uppercase; letter-spacing:0.06em;">
        Verification Code
      </p>
      <h1 style="margin:0 0 16px; font-family:'DM Sans',Arial,sans-serif;
                 font-size:24px; font-weight:800; color:#111827; line-height:1.2;">
        Your one-time code
      </h1>
      <p style="margin:0 0 28px; font-family:'DM Sans',Arial,sans-serif;
                font-size:15px; color:#6b7280; line-height:1.6;">
        Use the code below to complete your <strong style="color:#111827;">{purpose_label}</strong> on HealAll.
        This code expires in <strong style="color:#111827;">10 minutes</strong>.
      </p>

      <!-- OTP box -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center" style="padding: 0 0 28px;">
            <div style="display:inline-block; background:#f0fdf4; border:1.5px solid #bbf7d0;
                        border-radius:16px; padding:24px 40px; text-align:center;">
              <span class="otp-code"
                    style="font-family:'DM Sans',Arial,sans-serif;
                           font-size:44px; font-weight:800; letter-spacing:14px;
                           background:linear-gradient(135deg,#16a34a,#2563eb);
                           -webkit-background-clip:text; -webkit-text-fill-color:transparent;
                           color:#16a34a; display:block; line-height:1;">
                {otp_code}
              </span>
              <span style="font-family:'DM Sans',Arial,sans-serif;
                           font-size:11px; font-weight:600; color:#9ca3af;
                           text-transform:uppercase; letter-spacing:0.08em;
                           display:block; margin-top:10px;">
                One-time password
              </span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Security note -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:14px 18px;">
            <p style="margin:0; font-family:'DM Sans',Arial,sans-serif;
                      font-size:13px; color:#92400e; line-height:1.5;">
              🔒&nbsp; <strong>Never share this code.</strong>
              HealAll will never ask for your OTP over phone or chat.
            </p>
          </td>
        </tr>
      </table>
    """

    preview = f"Your HealAll OTP is {otp_code} — valid for 10 minutes"
    return subject, _base(content, preview)


def welcome_email(name: str) -> tuple[str, str]:
    """Returns (subject, html_body) for a welcome email after successful verification."""
    subject = f"Welcome to HealAll, {name}! 🤝"

    first_name = name.split()[0] if name else "there"

    content = f"""
      <p style="margin:0 0 6px; font-family:'DM Sans',Arial,sans-serif;
                font-size:13px; font-weight:700; color:#9ca3af;
                text-transform:uppercase; letter-spacing:0.06em;">
        You're in
      </p>
      <h1 style="margin:0 0 16px; font-family:'DM Sans',Arial,sans-serif;
                 font-size:24px; font-weight:800; color:#111827; line-height:1.2;">
        Welcome, {first_name}! 🎉
      </h1>
      <p style="margin:0 0 28px; font-family:'DM Sans',Arial,sans-serif;
                font-size:15px; color:#6b7280; line-height:1.6;">
        You've joined <strong style="color:#111827;">HealAll</strong> — India's invite-only
        mutual-aid community. Here's what you can do next:
      </p>

      <!-- Steps -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="margin-bottom:28px;">
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="background:#f0fdf4; border-radius:10px; padding:14px 18px;">
                  <p style="margin:0; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#15803d; font-weight:600;">
                    🧑‍💼&nbsp; Complete your profile
                  </p>
                  <p style="margin:4px 0 0; font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; line-height:1.5;">
                    Add skills, availability, and a short bio so the community knows you.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="background:#eff6ff; border-radius:10px; padding:14px 18px;">
                  <p style="margin:0; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#1d4ed8; font-weight:600;">
                    🗺️&nbsp; Browse help requests
                  </p>
                  <p style="margin:4px 0 0; font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; line-height:1.5;">
                    See what your community needs — medicine, shelter, food, finance, or just a hand.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="background:#faf5ff; border-radius:10px; padding:14px 18px;">
                  <p style="margin:0; font-family:'DM Sans',Arial,sans-serif; font-size:14px; color:#7c3aed; font-weight:600;">
                    🪪&nbsp; Verify your identity
                  </p>
                  <p style="margin:4px 0 0; font-family:'DM Sans',Arial,sans-serif; font-size:13px; color:#6b7280; line-height:1.5;">
                    Aadhaar verification unlocks all features and builds community trust.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="center">
            <a href="https://healallindia.com/feed"
               style="display:inline-block; font-family:'DM Sans',Arial,sans-serif;
                      font-size:15px; font-weight:700; color:#ffffff;
                      background:linear-gradient(135deg,#16a34a,#2563eb);
                      padding:13px 32px; border-radius:9999px; text-decoration:none;
                      box-shadow:0 3px 12px rgba(22,163,74,0.30);">
              Go to Feed →
            </a>
          </td>
        </tr>
      </table>
    """

    preview = f"Welcome to HealAll, {first_name}! You're now part of India's mutual-aid community."
    return subject, _base(content, preview)
