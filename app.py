import os
from flask import Flask, jsonify
from flask_cors import CORS

from database import init_db
from routes.ui           import ui_bp
from routes.chat         import chat_bp
from routes.ingest       import ingest_bp
from routes.sessions     import sessions_bp
from routes.auth_routes  import auth_bp

# ── Create Flask app ──────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# ── Secret key for session cookies ───────────────────
app.secret_key = os.environ.get("SECRET_KEY", "dsa-assistant-secret-2024")

# ── Initialize SQLite database ────────────────────────
init_db()

# ── Register all blueprints ───────────────────────────
app.register_blueprint(auth_bp)
app.register_blueprint(ui_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(ingest_bp)
app.register_blueprint(sessions_bp)

# ── Error handlers ────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# ── Run ───────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)