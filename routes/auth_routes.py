from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from db.user_store import create_user, get_user_by_email
from mailer import send_welcome_email
import threading

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/signup", methods=["GET"])
def signup_page():
    if "user_id" in session:
        return redirect(url_for("ui.home"))
    return render_template("signup.html")


@auth_bp.route("/login", methods=["GET"])
def login_page():
    if "user_id" in session:
        return redirect(url_for("ui.home"))
    return render_template("login.html")


@auth_bp.route("/api/signup", methods=["POST"])
def signup_api():
    data     = request.get_json(force=True)
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()
    password = data.get("password", "").strip()

    
    if not username or not email or not password:
        return jsonify({"error": "All fields are required."}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if "@" not in email:
        return jsonify({"error": "Invalid email address."}), 400

    
    result = create_user(username, email, password)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 409

    
    threading.Thread(
        target=send_welcome_email,
        args=(email, username, password),
        daemon=True
    ).start()

    
    user = result["user"]
    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    session["email"]    = user["email"]

    return jsonify({
        "message":  f"Welcome, {username}! Account created successfully.",
        "username": username,
        "redirect": "/chat"
    })


@auth_bp.route("/api/login", methods=["POST"])
def login_api():
    data     = request.get_json(force=True)
    email    = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    result = get_user_by_email(email, password)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 401

    user = result["user"]
    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    session["email"]    = user["email"]

    return jsonify({
        "message":  f"Welcome back, {user['username']}!",
        "username": user["username"],
        "redirect": "/chat"
    })


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login_page"))


@auth_bp.route("/api/me", methods=["GET"])
def me():
    """Returns current logged in user info."""
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify({
        "id":       session["user_id"],
        "username": session["username"],
        "email":    session["email"],
    })




@auth_bp.route("/forgot-password", methods=["GET"])
def forgot_password_page():
    return render_template("login.html", show_forgot=True)


@auth_bp.route("/api/forgot-password", methods=["POST"])
def forgot_password_api():
    """Step 1 — User enters email, we send OTP."""
    from db.user_store import email_exists, create_otp
    from mailer import send_otp_email
    from database import get_db

    data  = request.get_json(force=True)
    email = data.get("email", "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email is required."}), 400

    if not email_exists(email):
        
        return jsonify({"message": "If that email is registered, an OTP has been sent."})

    
    conn = get_db()
    row  = conn.execute("SELECT username FROM users WHERE email=?", (email,)).fetchone()
    conn.close()
    username = row["username"] if row else "User"

    otp = create_otp(email)

    threading.Thread(
        target=send_otp_email,
        args=(email, username, otp),
        daemon=True
    ).start()

    return jsonify({"message": "If that email is registered, an OTP has been sent."})


@auth_bp.route("/api/verify-otp", methods=["POST"])
def verify_otp_api():
    """Step 2 — Verify OTP is correct before showing reset form."""
    from db.user_store import verify_otp

    data  = request.get_json(force=True)
    email = data.get("email", "").strip().lower()
    otp   = data.get("otp",   "").strip()

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required."}), 400

    result = verify_otp(email, otp)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 400

    return jsonify({"message": "OTP verified."})


@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password_api():
    """Step 3 — Set new password after OTP verified."""
    from db.user_store import reset_password

    data         = request.get_json(force=True)
    email        = data.get("email",        "").strip().lower()
    otp          = data.get("otp",          "").strip()
    new_password = data.get("new_password", "").strip()

    if not email or not otp or not new_password:
        return jsonify({"error": "All fields are required."}), 400

    result = reset_password(email, otp, new_password)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 400

    return jsonify({"message": "Password reset successfully. You can now log in."})