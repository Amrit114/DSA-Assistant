import html
import json
import os
import smtplib
import threading
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load from environment variables
SMTP_EMAIL    = os.environ.get("SMTP_EMAIL")     # your Gmail address
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")  # Gmail App Password
# Render's free plan blocks outbound SMTP (ports 25/465/587), so in production
# mail goes through Brevo's HTTPS API instead. SMTP stays as the local fallback.
BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
MAIL_FROM     = os.environ.get("MAIL_FROM") or SMTP_EMAIL  # must be a verified Brevo sender
APP_URL       = os.environ.get("APP_URL", "").rstrip("/")  # e.g. https://your-app.onrender.com
TIMEOUT_SEC   = 15


def _log(message: str):
    # flush so the line shows up in Render/gunicorn logs right away
    print(f"[mailer] {message}", flush=True)


def _send_via_brevo(to_email: str, subject: str, html_body: str):
    payload = {
        "sender":      {"name": "DSA Assistant", "email": MAIL_FROM},
        "to":          [{"email": to_email}],
        "subject":     subject,
        "htmlContent": html_body,
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode(),
        headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC):
            pass
    except urllib.error.HTTPError as e:
        # Brevo explains the problem (unverified sender, bad key…) in the body.
        raise RuntimeError(f"Brevo HTTP {e.code}: {e.read().decode(errors='replace')[:300]}") from None


def _send_via_smtp(to_email: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"DSA Assistant <{SMTP_EMAIL}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=TIMEOUT_SEC) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())


def _send_email(to_email: str, subject: str, html_body: str, label: str):
    """Sends via Brevo when BREVO_API_KEY is set, otherwise Gmail SMTP."""
    if BREVO_API_KEY and MAIL_FROM:
        sender, via = _send_via_brevo, "Brevo"
    elif SMTP_EMAIL and SMTP_PASSWORD:
        sender, via = _send_via_smtp, "SMTP"
    else:
        _log(f"no mail credentials set (BREVO_API_KEY+MAIL_FROM or SMTP_EMAIL+SMTP_PASSWORD) — skipping {label}.")
        return

    try:
        sender(to_email, subject, html_body)
        _log(f"{label} sent to {to_email} via {via}")
    except Exception as e:
        _log(f"failed to send {label} via {via}: {e}")


def send_welcome_email(to_email: str, username: str):
    """Sends a welcome email to the new user after signup."""

    # Signup input — escape so a crafted username can't inject HTML into the email.
    username, to_email_html = html.escape(username), html.escape(to_email)
    login_url = html.escape(f"{APP_URL}/login") if APP_URL else "#"
    subject   = "Welcome to DSA Assistant 📚"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
        .wrapper {{ max-width: 560px; margin: 40px auto; background: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }}
        .header {{ background: #4f46e5; padding: 32px 40px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 26px; letter-spacing: 1px; }}
        .header p {{ color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }}
        .body {{ padding: 36px 40px; }}
        .body h2 {{ color: #f5f5f5; font-size: 20px; margin: 0 0 12px; }}
        .body p {{ color: #aaaaaa; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }}
        .creds {{ background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }}
        .creds p {{ margin: 6px 0; color: #aaaaaa; font-size: 14px; }}
        .creds span {{ color: #f5f5f5; font-weight: 600; font-family: monospace; }}
        .btn {{ display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0; }}
        .footer {{ padding: 20px 40px; text-align: center; border-top: 1px solid #1e1e1e; }}
        .footer p {{ color: #444; font-size: 12px; margin: 0; }}
        .note {{ background: rgba(79,70,229,0.08); border-left: 3px solid #4f46e5; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }}
        .note p {{ color: #aaaaaa; font-size: 13px; margin: 0; }}
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>📚 DSA Assistant</h1>
          <p>Your AI-powered Data Structures & Algorithms Tutor</p>
        </div>
        <div class="body">
          <h2>Welcome, {username}! 🎉</h2>
          <p>Your account has been created. You can now log in and start asking DSA questions from real textbooks.</p>
          <div class="creds">
            <p>👤 Username &nbsp;→&nbsp; <span>{username}</span></p>
            <p>📧 Email &nbsp;&nbsp;&nbsp;&nbsp;→&nbsp; <span>{to_email_html}</span></p>
          </div>
          <a href="{login_url}" class="btn">Sign in to DSA Assistant →</a>
        </div>
        <div class="footer">
          <p>This email was sent because you registered on DSA Assistant.</p>
        </div>
      </div>
    </body>
    </html>
    """

    threading.Thread(
        target=_send_email,
        args=(to_email, subject, html_body, "welcome email"),
        daemon=True
    ).start()


def send_otp_email(to_email: str, username: str, otp: str):
    """Sends a 6-digit OTP email for password reset."""

    username = html.escape(username)
    subject   = "Your DSA Assistant Password Reset OTP"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
        .wrapper {{ max-width: 520px; margin: 40px auto; background: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }}
        .header {{ background: #4f46e5; padding: 28px 40px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 22px; letter-spacing: 1px; }}
        .body {{ padding: 36px 40px; }}
        .body p {{ color: #aaaaaa; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }}
        .otp-box {{ background: #1a1a1a; border: 2px solid #4f46e5; border-radius: 14px; padding: 28px; text-align: center; margin: 28px 0; }}
        .otp-label {{ color: #888; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }}
        .otp-code {{ font-size: 48px; font-weight: 900; color: #4f46e5; letter-spacing: 12px; font-family: 'Courier New', monospace; }}
        .otp-expiry {{ color: #555; font-size: 12px; margin-top: 10px; }}
        .note {{ background: rgba(79,70,229,0.06); border-left: 3px solid #4f46e5; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }}
        .note p {{ color: #aaaaaa; font-size: 13px; margin: 0; }}
        .footer {{ padding: 20px 40px; text-align: center; border-top: 1px solid #1e1e1e; }}
        .footer p {{ color: #444; font-size: 12px; margin: 0; }}
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>🔑 Password Reset Request</h1>
        </div>
        <div class="body">
          <p>Hi <strong style="color:#f5f5f5">{username}</strong>,</p>
          <p>We received a request to reset your DSA Assistant password. Use the OTP below. It expires in <strong style="color:#f5f5f5">10 minutes</strong>.</p>
          <div class="otp-box">
            <div class="otp-label">Your One-Time Password</div>
            <div class="otp-code">{otp}</div>
            <div class="otp-expiry">⏱ Expires in 10 minutes</div>
          </div>
          <div class="note">
            <p>🔒 If you did not request this, ignore this email. Your password will not change.</p>
          </div>
        </div>
        <div class="footer">
          <p>DSA Assistant · Password Reset Service</p>
        </div>
      </div>
    </body>
    </html>
    """

    import threading
    threading.Thread(
        target=_send_email,
        args=(to_email, subject, html_body, "OTP email"),
        daemon=True
    ).start()