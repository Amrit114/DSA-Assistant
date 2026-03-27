import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load from environment variables
SMTP_EMAIL    = os.environ.get("SMTP_EMAIL")     # your Gmail address
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")  # Gmail App Password


def _send_email(to_email: str, subject: str, html_body: str, label: str):
    """
    Core email sender using port 587 + STARTTLS.
    Port 465 (SSL) is blocked on Render free tier.
    Port 587 (STARTTLS) works on Render.
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[mailer] SMTP credentials not set — skipping {label}.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"DSA Assistant <{SMTP_EMAIL}>"
        msg["To"]      = to_email

        msg.attach(MIMEText(html_body, "html"))

        # Use port 587 + STARTTLS — port 465 is blocked on Render free tier
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"[mailer] {label} sent to {to_email}")

    except Exception as e:
        print(f"[mailer] Failed to send {label}: {e}")


def send_welcome_email(to_email: str, username: str, password: str):
    """Sends a welcome email to the new user after signup."""

    subject   = "Welcome to DSA Assistant 📚"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
        .wrapper {{ max-width: 560px; margin: 40px auto; background: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }}
        .header {{ background: #e53935; padding: 32px 40px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 26px; letter-spacing: 1px; }}
        .header p {{ color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }}
        .body {{ padding: 36px 40px; }}
        .body h2 {{ color: #f5f5f5; font-size: 20px; margin: 0 0 12px; }}
        .body p {{ color: #aaaaaa; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }}
        .creds {{ background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }}
        .creds p {{ margin: 6px 0; color: #aaaaaa; font-size: 14px; }}
        .creds span {{ color: #f5f5f5; font-weight: 600; font-family: monospace; }}
        .btn {{ display: inline-block; background: #e53935; color: white; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0; }}
        .footer {{ padding: 20px 40px; text-align: center; border-top: 1px solid #1e1e1e; }}
        .footer p {{ color: #444; font-size: 12px; margin: 0; }}
        .note {{ background: rgba(229,57,53,0.08); border-left: 3px solid #e53935; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }}
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
            <p>📧 Email &nbsp;&nbsp;&nbsp;&nbsp;→&nbsp; <span>{to_email}</span></p>
            <p>🔑 Password &nbsp;→&nbsp; <span>{password}</span></p>
          </div>
          <div class="note">
            <p>🔒 Please change your password after first login for security.</p>
          </div>
          <a href="#" class="btn">Login to DSA Assistant →</a>
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


def send_otp_email(to_email: str, otp: str):
    """Sends a 6-digit OTP email for password reset."""

    subject   = "Your DSA Assistant Password Reset OTP"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
        .wrapper {{ max-width: 560px; margin: 40px auto; background: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }}
        .header {{ background: #e53935; padding: 32px 40px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 26px; }}
        .body {{ padding: 36px 40px; text-align: center; }}
        .body p {{ color: #aaaaaa; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }}
        .otp-box {{ background: #1a1a1a; border: 2px solid #e53935; border-radius: 12px; padding: 28px; margin: 24px 0; }}
        .otp {{ font-size: 42px; font-weight: 800; color: #e53935; letter-spacing: 12px; font-family: monospace; }}
        .expire {{ color: #666; font-size: 13px; margin-top: 12px; }}
        .footer {{ padding: 20px 40px; text-align: center; border-top: 1px solid #1e1e1e; }}
        .footer p {{ color: #444; font-size: 12px; margin: 0; }}
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header"><h1>📚 DSA Assistant</h1></div>
        <div class="body">
          <p>You requested a password reset. Use the OTP below:</p>
          <div class="otp-box">
            <div class="otp">{otp}</div>
            <div class="expire">⏱ Expires in 10 minutes</div>
          </div>
          <p>If you did not request this, ignore this email.</p>
        </div>
        <div class="footer"><p>DSA Assistant — AI-powered DSA Tutor</p></div>
      </div>
    </body>
    </html>
    """

    threading.Thread(
        target=_send_email,
        args=(to_email, subject, html_body, "OTP email"),
        daemon=True
    ).start()