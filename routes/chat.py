import uuid
from flask import Blueprint, request, jsonify, session
from auth import json_body
from database import get_connection, now_iso
from rag.rag_pipeline import rag_answer

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/ask", methods=["POST"])
def ask_api():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    data       = json_body()
    question   = str(data.get("question") or "").strip()
    session_id = str(data.get("session_id") or "").strip()

    if not question:
        return jsonify({"error": "Question required"}), 400

    # Checked before calling the LLM so a bad request doesn't cost an answer.
    conn   = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM users WHERE id=%s", (user_id,))
        if not cursor.fetchone():
            # Login cookie of an account that no longer exists.
            session.clear()
            return jsonify({"error": "Your session has expired. Please sign in again."}), 401
        if session_id:
            cursor.execute("SELECT user_id FROM sessions WHERE id=%s", (session_id,))
            owner = cursor.fetchone()
            if owner and owner["user_id"] != user_id:
                return jsonify({"error": "Chat not found."}), 404
    finally:
        conn.close()

    answer = rag_answer(question)
    ts     = now_iso()

    conn   = get_connection()
    cursor = conn.cursor()

    
    if not session_id:
        session_id = str(uuid.uuid4())
        title      = question[:60] + ("..." if len(question) > 60 else "")
        cursor.execute(
            "INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (%s,%s,%s,%s,%s)",
            (session_id, user_id, title, ts, ts)
        )
    else:
        cursor.execute(
            "SELECT id FROM sessions WHERE id=%s AND user_id=%s",
            (session_id, user_id)
        )
        row = cursor.fetchone()

        if not row:
            title = question[:60] + ("..." if len(question) > 60 else "")
            cursor.execute(
                "INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (%s,%s,%s,%s,%s)",
                (session_id, user_id, title, ts, ts)
            )
        else:
            cursor.execute(
                "UPDATE sessions SET updated_at=%s WHERE id=%s AND user_id=%s",
                (ts, session_id, user_id)
            )

    cursor.execute(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (%s,%s,%s,%s)",
        (session_id, "user", question, ts)
    )
    cursor.execute(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (%s,%s,%s,%s)",
        (session_id, "assistant", answer, ts)
    )

    conn.commit()
    conn.close()

    return jsonify({"question": question, "answer": answer, "session_id": session_id})