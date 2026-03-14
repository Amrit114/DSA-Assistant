import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


# Load from environment variables
SMTP_EMAIL    = os.environ.get("SMTP_EMAIL")     # your Gmail address
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")  # Gmail App Password


def send_welcome_email(to_email: str, username: str, password: str):
    """
    Sends a welcome email to the new user after signup.
    Just like Claude/ChatGPT welcome emails.
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("[mailer] SMTP credentials not set — skipping email.")
        return

    subject = "Welcome to DSA Assistant 📚"

    # HTML email body
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
          <p>Your account has been successfully created. You can now log in and start asking questions from your DSA textbooks using our RAG-powered assistant.</p>

          <div class="creds">
            <p>👤 Username &nbsp;→&nbsp; <span>{username}</span></p>
            <p>📧 Email &nbsp;&nbsp;&nbsp;&nbsp;→&nbsp; <span>{to_email}</span></p>
            <p>🔑 Password &nbsp;→&nbsp; <span>{password}</span></p>
          </div>

          <div class="note">
            <p>🔒 Please change your password after your first login for security.</p>
          </div>

          <p>Start exploring topics like Binary Search Trees, Dynamic Programming, Graph Algorithms and more — all answered directly from your indexed textbooks.</p>

          <a href="#" class="btn">Login to DSA Assistant →</a>
        </div>

        <div class="footer">
          <p>This email was sent because you registered on DSA Assistant.<br/>
          If you did not register, please ignore this email.</p>
        </div>

      </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"DSA Assistant <{SMTP_EMAIL}>"
        msg["To"]      = to_email

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"[mailer] Welcome email sent to {to_email}")

    except Exception as e:
        print(f"[mailer] Failed to send email: {e}")


def send_otp_email(to_email: str, username: str, otp: str):
    """
    Sends a password reset OTP email.
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("[mailer] SMTP credentials not set — skipping OTP email.")
        return

    subject = "Your DSA Assistant Password Reset OTP"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}
        .wrapper {{ max-width: 520px; margin: 40px auto; background: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }}
        .header {{ background: #e53935; padding: 28px 40px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 22px; letter-spacing: 1px; }}
        .body {{ padding: 36px 40px; }}
        .body p {{ color: #aaaaaa; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }}
        .otp-box {{ background: #1a1a1a; border: 2px solid #e53935; border-radius: 14px; padding: 28px; text-align: center; margin: 28px 0; }}
        .otp-label {{ color: #888; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }}
        .otp-code {{ font-size: 48px; font-weight: 900; color: #e53935; letter-spacing: 12px; font-family: 'Courier New', monospace; }}
        .otp-expiry {{ color: #555; font-size: 12px; margin-top: 10px; }}
        .note {{ background: rgba(229,57,53,0.06); border-left: 3px solid #e53935; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }}
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
          <p>We received a request to reset your DSA Assistant password. Use the OTP below to continue. It expires in <strong style="color:#f5f5f5">10 minutes</strong>.</p>

          <div class="otp-box">
            <div class="otp-label">Your One-Time Password</div>
            <div class="otp-code">{otp}</div>
            <div class="otp-expiry">⏱ Expires in 10 minutes</div>
          </div>

          <div class="note">
            <p>🔒 If you did not request this, you can safely ignore this email. Your password will not change.</p>
          </div>
        </div>
        <div class="footer">
          <p>DSA Assistant · Password Reset Service</p>
        </div>
      </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"DSA Assistant <{SMTP_EMAIL}>"
        msg["To"]      = to_email

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        print(f"[mailer] OTP email sent to {to_email}")

    except Exception as e:
        print(f"[mailer] Failed to send OTP email: {e}")