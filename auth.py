from functools import wraps
from flask import session, redirect, url_for

API_KEY = "my-secret-key"


def check_api_key(req):
    """Check X-API-KEY header for ingest endpoint."""
    return req.headers.get("X-API-KEY") == API_KEY


def login_required(f):
    """Decorator — redirects to login if user not in session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login_page"))
        return f(*args, **kwargs)
    return decorated


def get_current_user():
    """Returns current logged-in user's id and username from session."""
    return {
        "id":       session.get("user_id"),
        "username": session.get("username"),
        "email":    session.get("email"),
    }