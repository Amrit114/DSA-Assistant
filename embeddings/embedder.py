import os
from langchain_huggingface import HuggingFaceEmbeddings

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

_model = None


def get_embedding_model():
    global _model
    if _model is None:
        _model = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
            cache_folder="/tmp/hf_cache"
        )
    return _model