from db.connection import get_connection
from embeddings.embedder import get_embedding_model

embedding_model = get_embedding_model()


def similarity_search(query: str, top_k: int = 7) -> str:
    """
    Returns labeled context string for relevant chunks only.
    Chunks with similarity distance above THRESHOLD are rejected.
    This prevents off-topic questions from getting any context.
    """
    query_vector = embedding_model.embed_query(query)

    conn = get_connection()
    cur  = conn.cursor()

    # Fetch distance score alongside content
    # Lower distance = more similar (0.0 is perfect match)
    cur.execute(
        """
        SELECT content, source_file, file_hash,
               embedding <-> %s::vector AS distance
        FROM documents
        ORDER BY distance
        LIMIT %s
        """,
        (query_vector, top_k)
    )

    results = cur.fetchall()
    cur.close()
    conn.close()

    # Distance threshold — chunks above this are too unrelated
    # 0.0 = identical, 1.0 = completely unrelated
    # DSA questions score ~0.3-0.6, off-topic score ~0.7-1.0
    THRESHOLD = 0.88

    context_parts = []
    for content, source_file, file_hash, distance in results:
        if distance > THRESHOLD:
            continue  # skip irrelevant chunks
        src   = source_file if source_file else "Unknown Source"
        label = f"[Source: {src}]"
        context_parts.append(f"{label}\n{content}")

    return "\n\n---\n\n".join(context_parts)