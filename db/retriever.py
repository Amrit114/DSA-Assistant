from db.connection import get_connection
from embeddings.embedder import get_embedding_model




def similarity_search(query: str, top_k: int = 7) -> str:
    """
    Returns labeled context string for relevant chunks only.
    Chunks with similarity distance above THRESHOLD are rejected.
    This prevents off-topic questions from getting any context.
    """
    embedding_model = get_embedding_model()
    query_vector = embedding_model.embed_query(query)

    conn = get_connection()
    cur  = conn.cursor()

    
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

    
    THRESHOLD = 0.88

    context_parts = []
    for row in results:
        try:
            distance = float(row["distance"])   # 🔥 IMPORTANT
        except:
            continue

        if distance > THRESHOLD:
            continue  
        content     = row["content"]
        source_file = row["source_file"]

        src   = source_file if source_file else "Unknown Source"
        label = f"[Source: {src}]"

        context_parts.append(f"{label}\n{content}")

    return "\n\n---\n\n".join(context_parts)