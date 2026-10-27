from functools import wraps
from flask import session, redirect, url_for, request
from werkzeug.exceptions import BadRequest


def json_body() -> dict:
    """Request JSON as a dict; a missing or malformed body becomes a 400 (rendered as JSON by app.py)."""
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        raise BadRequest("Request body must be a JSON object.")
    return data


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