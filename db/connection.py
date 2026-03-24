import psycopg2
from psycopg2.extras import RealDictCursor
from config import DB_CONFIG

def get_connection():
    return psycopg2.connect(
        **DB_CONFIG,
        sslmode='require',
        cursor_factory=RealDictCursor
    )