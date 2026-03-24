from flask import Blueprint, request, jsonify, session
from auth import check_api_key
from database import get_connection

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/sessions", methods=["GET"])
def get_sessions():
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, created_at, updated_at FROM sessions WHERE user_id=%s ORDER BY updated_at DESC",
        (user_id,)
    )
    rows = cur.fetchall()
    conn.close()

    return jsonify({"sessions": [dict(r) for r in rows]})


@sessions_bp.route("/api/sessions/<session_id>", methods=["GET"])
def get_session_messages(session_id):
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM sessions WHERE id=%s AND user_id=%s",
        (session_id, user_id)
    )
    sess = cur.fetchone()

    if not sess:
        conn.close()
        return jsonify({"error": "Session not found"}), 404

    cur.execute(
        "SELECT role, content, created_at FROM messages WHERE session_id=%s ORDER BY id ASC",
        (session_id,)
    )
    messages = cur.fetchall()
    conn.close()

    return jsonify({"session": dict(sess), "messages": [dict(m) for m in messages]})


@sessions_bp.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_id")
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "DELETE FROM messages WHERE session_id=%s", (session_id,)
    )
    cur.execute(
        "DELETE FROM sessions WHERE id=%s AND user_id=%s", (session_id, user_id)
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

    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute(
        "SELECT id FROM sessions WHERE user_id=%s", (user_id,)
    )
    rows = cur.fetchall()

    for row in rows:
        cur.execute("DELETE FROM messages WHERE session_id=%s", (row["id"],))

    cur.execute("DELETE FROM sessions WHERE user_id=%s", (user_id,))
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

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "UPDATE sessions SET title=%s WHERE id=%s AND user_id=%s",
        (title, session_id, user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "Renamed"})