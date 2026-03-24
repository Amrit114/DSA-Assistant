import uuid
from flask import Blueprint, request, jsonify, session
from auth import check_api_key, get_current_user
from database import get_connection, now_iso
from rag.rag_pipeline import rag_answer

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/ask", methods=["POST"])
def ask_api():
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Login required"}), 401

    data       = request.get_json(force=True)
    question   = data.get("question", "").strip()
    session_id = data.get("session_id", "").strip()

    if not question:
        return jsonify({"error": "Question required"}), 400

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