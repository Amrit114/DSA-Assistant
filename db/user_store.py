import hashlib
import random
import string
from datetime import datetime, timedelta
from database import get_db, now_iso


def hash_password(password: str) -> str:
    """Simple SHA-256 hash for password storage."""
    return hashlib.sha256(password.encode()).hexdigest()


def create_user(username: str, email: str, password: str) -> dict:
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)",
            (username.strip(), email.strip().lower(), hash_password(password), now_iso())
        )
        conn.commit()

        user = conn.execute(
            "SELECT id, username, email FROM users WHERE email = ?",
            (email.strip().lower(),)
        ).fetchone()

        return {"success": True, "user": dict(user)}

    except Exception as e:
        error = str(e)
        if "UNIQUE constraint failed: users.email" in error:
            return {"success": False, "error": "Email already registered."}
        if "UNIQUE constraint failed: users.username" in error:
            return {"success": False, "error": "Username already taken."}
        return {"success": False, "error": "Registration failed. Please try again."}

    finally:
        conn.close()


def get_user_by_email(email: str, password: str) -> dict:
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, email FROM users WHERE email = ? AND password = ?",
            (email.strip().lower(), hash_password(password))
        ).fetchone()

        if user:
            return {"success": True, "user": dict(user)}
        return {"success": False, "error": "Invalid email or password."}

    finally:
        conn.close()


def email_exists(email: str) -> bool:
    """Check if an email is registered."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def create_otp(email: str) -> str:
    """
    Generate a 6-digit OTP, store it in reset_tokens, return the OTP.
    Expires in 10 minutes. Invalidates any previous OTPs for this email.
    """
    otp        = ''.join(random.choices(string.digits, k=6))
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")

    conn = get_db()
    
    conn.execute("UPDATE reset_tokens SET used=1 WHERE email=?", (email.strip().lower(),))
    
    conn.execute(
        "INSERT INTO reset_tokens (email, otp, expires_at, used) VALUES (?, ?, ?, 0)",
        (email.strip().lower(), otp, expires_at)
    )
    conn.commit()
    conn.close()

    return otp


def verify_otp(email: str, otp: str) -> dict:
    """
    Verify the OTP for an email.
    Returns { "success": True } or { "success": False, "error": "..." }
    """
    conn = get_db()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        row = conn.execute(
            """
            SELECT id FROM reset_tokens
            WHERE email=? AND otp=? AND used=0 AND expires_at > ?
            ORDER BY id DESC LIMIT 1
            """,
            (email.strip().lower(), otp.strip(), now)
        ).fetchone()

        if not row:
            return {"success": False, "error": "Invalid or expired OTP."}
        return {"success": True}

    finally:
        conn.close()


def reset_password(email: str, otp: str, new_password: str) -> dict:
    """
    Verify OTP and update password.
    Marks token as used after success.
    """
    verify = verify_otp(email, otp)
    if not verify["success"]:
        return verify

    if len(new_password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters."}

    conn = get_db()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        
        conn.execute(
            "UPDATE users SET password=? WHERE email=?",
            (hash_password(new_password), email.strip().lower())
        )
        
        conn.execute(
            "UPDATE reset_tokens SET used=1 WHERE email=? AND otp=?",
            (email.strip().lower(), otp.strip())
        )
        conn.commit()
        return {"success": True}

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        conn.close()


def get_user_by_id(user_id: int):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(user) if user else None
    finally:
        conn.close()