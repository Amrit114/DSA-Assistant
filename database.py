import os
from db.connection import get_connection


def init_db():
    """Create all tables in PostgreSQL if they don't exist."""
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         SERIAL PRIMARY KEY,
            username   TEXT UNIQUE NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id         TEXT PRIMARY KEY,
            user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title      TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id         SERIAL PRIMARY KEY,
            session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
            role       TEXT,
            content    TEXT,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS reset_tokens (
            id         SERIAL PRIMARY KEY,
            email      TEXT,
            otp        TEXT,
            expires_at TEXT,
            used       INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    cur.close()
    conn.close()


def get_db():
    """Returns a PostgreSQL connection."""
    return get_connection()


def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()