from db.connection import get_connection


def ensure_columns():
    """
    Add source_file and file_hash columns to documents table
    if they don't already exist. Safe to call every time.
    """
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_file TEXT")
    cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash   TEXT")
    conn.commit()
    cur.close()
    conn.close()