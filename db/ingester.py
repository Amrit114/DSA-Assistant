import time
from db.connection import get_connection
from db.schema import ensure_columns
from db.cleaner import clean_text
from embeddings.embedder import get_embedding_model

embedding_model = get_embedding_model()


def store_documents(chunks) -> dict:
    """
    Embeds each chunk and inserts into PostgreSQL.
    Prints live progress every 50 chunks with timing info.
    Returns a timing summary dict.
    """
    ensure_columns()

    total_chunks  = len(chunks)
    stored_count  = 0
    skipped_count = 0
    embed_total   = 0.0
    db_total      = 0.0
    total_start   = time.time()

    print(f"\n{'='*50}")
    print(f"  Starting ingestion of {total_chunks} chunks")
    print(f"{'='*50}")

    conn = get_connection()
    cur  = conn.cursor()

    for i, chunk in enumerate(chunks, 1):
        cleaned_text = clean_text(chunk.page_content)

        if not cleaned_text:
            skipped_count += 1
            continue

        
        embed_start  = time.time()
        vector       = embedding_model.embed_query(cleaned_text)
        embed_total += time.time() - embed_start

        source_file = chunk.metadata.get("source_file", None)
        file_hash   = chunk.metadata.get("file_hash",   None)

        
        db_start  = time.time()
        cur.execute(
            "INSERT INTO documents (content, embedding, source_file, file_hash) VALUES (%s, %s, %s, %s)",
            (cleaned_text, vector, source_file, file_hash)
        )
        db_total += time.time() - db_start

        stored_count += 1

        
        if i % 50 == 0 or i == total_chunks:
            elapsed   = time.time() - total_start
            per_chunk = elapsed / i
            remaining = per_chunk * (total_chunks - i)
            print(
                f"  [{i}/{total_chunks}]  "
                f"Elapsed: {elapsed:.1f}s  |  "
                f"Est. remaining: {remaining:.1f}s"
            )

    conn.commit()
    cur.close()
    conn.close()

    total_time = time.time() - total_start

    print(f"\n{'='*50}")
    print(f"  Ingestion Complete!")
    print(f"  Total chunks processed : {total_chunks}")
    print(f"  Stored in DB           : {stored_count}")
    print(f"  Skipped (empty)        : {skipped_count}")
    print(f"  Embedding time         : {embed_total:.2f}s")
    print(f"  DB insert time         : {db_total:.2f}s")
    print(f"  Total time             : {total_time:.2f}s")
    print(f"{'='*50}\n")

    return {
        "total_chunks":  total_chunks,
        "stored_count":  stored_count,
        "skipped_count": skipped_count,
        "embed_time":    round(embed_total, 2),
        "db_time":       round(db_total, 2),
        "total_time":    round(total_time, 2),
    }