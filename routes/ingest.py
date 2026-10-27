from flask import Blueprint, request, jsonify, session
import os
from db.vector_store import store_documents, get_ingested_files
from loaders.pdf_loader import load_and_split_pdfs_from_directory
from config import PDF_DIR

ingest_bp = Blueprint("ingest", __name__)


@ingest_bp.route("/api/ingest", methods=["POST"])
def ingest_api():
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    
    already_ingested = get_ingested_files()

    
    result        = load_and_split_pdfs_from_directory(PDF_DIR, already_ingested)
    chunks        = result["chunks"]
    new_files     = result["new_files"]
    skipped_files = result["skipped_files"]

    
    timing = None
    if chunks:
        timing = store_documents(chunks)

    
    response = {}

    if new_files:
        response["indexed"] = {
            "files":   new_files,
            "message": f"{len(new_files)} file(s) successfully indexed."
        }
        if timing:
            response["timing"] = {
                "total_chunks":   timing["total_chunks"],
                "stored":         timing["stored_count"],
                "embed_time_sec": timing["embed_time"],
                "db_time_sec":    timing["db_time"],
                "total_time_sec": timing["total_time"],
                "summary": (
                    f"Indexed {timing['stored_count']} chunks in "
                    f"{timing['total_time']}s "
                    f"(embedding: {timing['embed_time']}s, "
                    f"DB insert: {timing['db_time']}s)"
                )
            }

    if skipped_files:
        response["skipped"] = {
            "files":   skipped_files,
            "message": (
                f"{len(skipped_files)} file(s) already exist in the "
                f"database and were not re-uploaded."
            )
        }

    if not new_files and not skipped_files:
        response["message"] = "No PDF files found in the directory."

    return jsonify(response)


# ── NEW: Upload a single PDF and immediately ingest it ──────────────
@ingest_bp.route("/api/upload-pdf", methods=["POST"])
def upload_pdf():
    """
    Accepts a multipart/form-data POST with a 'file' field containing a PDF.
    Saves it to PDF_DIR then runs the ingest pipeline on just that file.
    No authentication header required — user must be logged-in (session).
    """

    # Must be logged in
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]

    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Only accept PDFs
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted"}), 400

    # Ensure the data directory exists
    os.makedirs(PDF_DIR, exist_ok=True)

    # Sanitise filename (keep basename only to prevent path traversal)
    safe_name = os.path.basename(f.filename)
    dest_path = os.path.join(PDF_DIR, safe_name)

    # Save to disk
    f.save(dest_path)

    # Run ingest pipeline — it will skip already-ingested files automatically
    already_ingested = get_ingested_files()
    result           = load_and_split_pdfs_from_directory(PDF_DIR, already_ingested)
    chunks        = result["chunks"]
    new_files     = result["new_files"]
    skipped_files = result["skipped_files"]

    timing = None
    if chunks:
        timing = store_documents(chunks)

    response = {"filename": safe_name}

    if safe_name in skipped_files:
        return jsonify({
            "filename": safe_name,
            "message":  f"'{safe_name}' is already indexed in the database.",
            "status":   "already_exists"
        })

    if new_files:
        response["status"]  = "indexed"
        response["message"] = f"'{safe_name}' uploaded and indexed successfully."
        if timing:
            response["chunks"]      = timing["stored_count"]
            response["total_time"]  = timing["total_time"]
            response["embed_time"]  = timing["embed_time"]
    else:
        response["status"]  = "saved"
        response["message"] = f"'{safe_name}' saved but no new chunks were indexed."

    return jsonify(response)
