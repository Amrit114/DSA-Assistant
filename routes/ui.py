from flask import Blueprint, render_template, request, session
from auth import login_required, get_current_user
from rag.rag_pipeline import rag_answer

ui_bp = Blueprint("ui", __name__)


@ui_bp.route("/", methods=["GET"])
def home():
    """
    / → landing page for guests
    / → chat page for logged-in users
    """
    if "user_id" in session:
        user = get_current_user()
        return render_template("index.html", username=user["username"])
    return render_template("landing.html")


@ui_bp.route("/chat", methods=["GET"])
@login_required
def chat():
    """Direct link to chat — always requires login."""
    user = get_current_user()
    return render_template("index.html", username=user["username"])


@ui_bp.route("/ask-ui", methods=["POST"])
@login_required
def ask_ui():
    question = request.form.get("question", "").strip()
    if not question:
        return render_template("index.html", error="Question required")
    answer = rag_answer(question)
    return render_template("index.html", question=question, answer=answer)