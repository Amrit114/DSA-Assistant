from langchain_huggingface import HuggingFaceEmbeddings
from config import EMBEDDING_MODEL

# Model is None at startup — loads only when first used
_embedding_model = None


def get_embedding_model():
    """
    Returns the embedding model.
    Loads it on first call only — not at startup.
    This saves RAM on Render free tier.
    """
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
    return _embedding_model