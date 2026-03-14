import os
import urllib.parse as urlparse

DATABASE_URL = os.environ.get('DATABASE_URL', '')

if DATABASE_URL:
    url = urlparse.urlparse(DATABASE_URL)
    DB_CONFIG = {
        'host':     url.hostname,
        'port':     url.port or 5432,
        'database': url.path[1:],
        'user':     url.username,
        'password': url.password,
    }
else:
    DB_CONFIG = {
        'host':     os.environ.get('DB_HOST'),
        'port':     int(os.environ.get('DB_PORT', 5432)),
        'database': os.environ.get('DB_NAME'),
        'user':     os.environ.get('DB_USER'),
        'password': os.environ.get('DB_PASSWORD'),
    }

GROQ_API_KEY    = os.environ.get('GROQ_API_KEY')
GROQ_MODEL      = os.environ.get('GROQ_MODEL', 'llama3-8b-8192')
EMBEDDING_MODEL = os.environ.get('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
PDF_DIR         = os.environ.get('PDF_DIR', 'pdfs')
SECRET_KEY      = os.environ.get('SECRET_KEY', 'fallback-secret-key')