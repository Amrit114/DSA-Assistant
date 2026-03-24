import hashlib
import random
import string
from datetime import datetime, timedelta
from database import get_connection, now_iso


def hash_password(password: str) -> str:
    """Simple SHA-256 hash for password storage."""
    return hashlib.sha256(password.encode()).hexdigest()


def create_user(username: str, email: str, password: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, email, password, created_at) VALUES (%s,%s,%s,%s)",
            (username.strip(), email.strip().lower(), hash_password(password), now_iso())
        )
        conn.commit()

        cur.execute(
            "SELECT id, username, email FROM users WHERE email = %s",
            (email.strip().lower(),)
        )
        user = cur.fetchone()

        return {"success": True, "user": dict(user)}

    except Exception as e:
        error = str(e)
        if "users_email_key" in error:
            return {"success": False, "error": "Email already registered."}
        if "users_username_key" in error:
            return {"success": False, "error": "Username already taken."}
        return {"success": False, "error": error}

    finally:
        conn.close()


def get_user_by_email(email: str, password: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, username, email FROM users WHERE email = %s AND password = %s",
            (email.strip().lower(), hash_password(password))
        )
        user = cur.fetchone()

        if not user:
            return {"success": False, "error": "Invalid email or password."}
        return {"success": True, "user": dict(user)}

    finally:
        conn.close()


def email_exists(email: str) -> bool:
    """Check if an email is registered."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id FROM users WHERE email = %s", (email.strip().lower(),)
        )
        row = cur.fetchone()
        return row is not None
    finally:
        conn.close()


def create_otp(email: str) -> str:
    otp = ''.join(random.choices(string.digits, k=6))
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")

    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("UPDATE reset_tokens SET used=1 WHERE email=%s", (email.strip().lower(),))
    
    cur.execute(
        "INSERT INTO reset_tokens (email, otp, expires_at, used) VALUES (%s, %s, %s, 0)",
        (email.strip().lower(), otp, expires_at)
    )
    conn.commit()
    conn.close()

    return otp


def verify_otp(email: str, otp: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        cur.execute(
            """
            SELECT id FROM reset_tokens
            WHERE email=%s AND otp=%s AND used=0 AND expires_at > %s
            ORDER BY id DESC LIMIT 1
            """,
            (email.strip().lower(), otp.strip(), now)
        )
        row = cur.fetchone()

        if not row:
            return {"success": False, "error": "Invalid or expired OTP."}
        return {"success": True}

    finally:
        conn.close()


def reset_password(email: str, otp: str, new_password: str) -> dict:
    verify = verify_otp(email, otp)
    if not verify["success"]:
        return verify

    if len(new_password) < 6:
        return {"success": False, "error": "Password must be at least 6 characters."}

    conn = get_connection()
    cur = conn.cursor()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        cur.execute(
            "UPDATE users SET password=%s WHERE email=%s",
            (hash_password(new_password), email.strip().lower())
        )
        
        cur.execute(
            "UPDATE reset_tokens SET used=1 WHERE email=%s AND otp=%s",
            (email.strip().lower(), otp.strip())
        )
        conn.commit()
        return {"success": True}

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        conn.close()


def get_user_by_id(user_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, username, email FROM users WHERE id = %s", (user_id,)
        )
        user = cur.fetchone()
        return dict(user) if user else None
    finally:
        conn.close()