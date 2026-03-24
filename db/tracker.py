from db.connection import get_connection
from db.schema import ensure_columns


def get_ingested_files() -> dict:
    """
    Returns { filename: file_hash } for all files already stored in DB.
    Used by pdf_loader to skip already-ingested files.
    """
    ensure_columns()

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT DISTINCT source_file, file_hash FROM documents WHERE source_file IS NOT NULL"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {
        row["source_file"]: row["file_hash"]
        for row in rows
        if row["source_file"] and row["file_hash"]
    }