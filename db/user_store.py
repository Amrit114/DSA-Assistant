import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_connection, now_iso

MAX_OTP_ATTEMPTS    = 5   # wrong guesses before an OTP is burned
MAX_OTPS_PER_WINDOW = 3   # OTPs per email per 10-minute window


def hash_password(password: str) -> str:
    """Salted, slow hash (werkzeug scrypt) for password storage."""
    return generate_password_hash(password)


def _is_legacy_hash(stored: str) -> bool:
    # Accounts created before the switch hold a bare unsalted SHA-256 hex digest.
    return "$" not in stored


def verify_password(stored: str, password: str) -> bool:
    if _is_legacy_hash(stored):
        legacy = hashlib.sha256(password.encode()).hexdigest()
        return hmac.compare_digest(stored, legacy)
    return check_password_hash(stored, password)


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
            "SELECT id, username, email, password FROM users WHERE email = %s",
            (email.strip().lower(),)
        )
        user = cur.fetchone()

        if not user or not verify_password(user["password"], password):
            return {"success": False, "error": "Invalid email or password."}

        # Upgrade legacy SHA-256 hashes on successful login.
        if _is_legacy_hash(user["password"]):
            cur.execute(
                "UPDATE users SET password=%s WHERE id=%s",
                (hash_password(password), user["id"])
            )
            conn.commit()

        return {"success": True, "user": {k: user[k] for k in ("id", "username", "email")}}

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


def create_otp(email: str):
    """Returns a new 6-digit OTP, or None if this email hit the rate limit."""
    email      = email.strip().lower()
    now        = datetime.utcnow()
    now_str    = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    expires_at = (now + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    otp        = f"{secrets.randbelow(10**6):06d}"

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Unexpired rows = OTPs issued in the last 10 minutes.
        cur.execute(
            "SELECT COUNT(*) AS n FROM reset_tokens WHERE email=%s AND expires_at > %s",
            (email, now_str)
        )
        if cur.fetchone()["n"] >= MAX_OTPS_PER_WINDOW:
            return None

        cur.execute("UPDATE reset_tokens SET used=1 WHERE email=%s", (email,))
        cur.execute(
            "INSERT INTO reset_tokens (email, otp, expires_at, used) VALUES (%s, %s, %s, 0)",
            (email, otp, expires_at)
        )
        conn.commit()
        return otp
    finally:
        conn.close()


def verify_otp(email: str, otp: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    try:
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        # Count the attempt atomically before comparing, so parallel guesses can't exceed the cap.
        cur.execute(
            """
            UPDATE reset_tokens SET attempts = attempts + 1
            WHERE id = (
                SELECT id FROM reset_tokens
                WHERE email=%s AND used=0 AND expires_at > %s
                ORDER BY id DESC LIMIT 1
            ) AND attempts < %s
            RETURNING otp
            """,
            (email.strip().lower(), now, MAX_OTP_ATTEMPTS)
        )
        row = cur.fetchone()
        conn.commit()

        if not row or not hmac.compare_digest(row["otp"].encode(), otp.strip().encode()):
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