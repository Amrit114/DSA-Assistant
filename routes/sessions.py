from flask import Blueprint, request, jsonify, session
from auth import check_api_key
from database import get_db

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/sessions", methods=["GET"])
def get_sessions():
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, created_at, updated_at FROM sessions WHERE user_id=? ORDER BY updated_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()

    return jsonify({"sessions": [dict(r) for r in rows]})


@sessions_bp.route("/api/sessions/<session_id>", methods=["GET"])
def get_session_messages(session_id):
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    conn    = get_db()
    sess    = conn.execute(
        "SELECT * FROM sessions WHERE id=? AND user_id=?",
        (session_id, user_id)
    ).fetchone()

    if not sess:
        conn.close()
        return jsonify({"error": "Session not found"}), 404

    messages = conn.execute(
        "SELECT role, content, created_at FROM messages WHERE session_id=? ORDER BY id ASC",
        (session_id,)
    ).fetchall()
    conn.close()

    return jsonify({"session": dict(sess), "messages": [dict(m) for m in messages]})


@sessions_bp.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    conn = get_db()
    conn.execute(
        "DELETE FROM messages WHERE session_id=?", (session_id,)
    )
    conn.execute(
        "DELETE FROM sessions WHERE id=? AND user_id=?", (session_id, user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "Deleted"})


@sessions_bp.route("/api/sessions", methods=["DELETE"])
def delete_all_sessions():
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    conn = get_db()
    # Only delete THIS user's sessions
    rows = conn.execute(
        "SELECT id FROM sessions WHERE user_id=?", (user_id,)
    ).fetchall()
    for row in rows:
        conn.execute("DELETE FROM messages WHERE session_id=?", (row["id"],))
    conn.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "All deleted"})


@sessions_bp.route("/api/sessions/<session_id>/title", methods=["PATCH"])
def rename_session(session_id):
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    data    = request.get_json(force=True)
    title   = data.get("title", "").strip()

    if not title:
        return jsonify({"error": "Title required"}), 400

    conn = get_db()
    conn.execute(
        "UPDATE sessions SET title=? WHERE id=? AND user_id=?",
        (title, session_id, user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "Renamed"})