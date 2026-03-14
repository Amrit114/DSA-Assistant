from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
import os

# Use a tiny model that loads fast
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

_model = None

def get_embedding_model():
    global _model
    if _model is None:
        _model = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
            cache_folder="/tmp/hf_cache"   # ← cache to /tmp on Render
        )
    return _model