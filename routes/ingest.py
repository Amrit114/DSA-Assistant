from flask import Blueprint, request, jsonify
from auth import check_api_key
from db.vector_store import store_documents, get_ingested_files
from loaders.pdf_loader import load_and_split_pdfs_from_directory
from config import PDF_DIR

ingest_bp = Blueprint("ingest", __name__)


@ingest_bp.route("/api/ingest", methods=["POST"])
def ingest_api():
    if not check_api_key(request):
        return jsonify({"error": "Unauthorized"}), 401

    
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