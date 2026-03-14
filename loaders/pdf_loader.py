from pathlib import Path
from loaders.filter   import filter_new_files
from loaders.loader   import load_pdfs
from loaders.splitter import split_documents


def load_and_split_pdfs_from_directory(pdf_directory, already_ingested: dict = None) -> dict:
    """
    Main entry point — loads and splits only NEW PDFs.
    Skips files already ingested in PostgreSQL.

    Returns:
        {
            "chunks"        : list of document chunks (new files only),
            "new_files"     : filenames that were processed,
            "skipped_files" : filenames already in DB,
        }
    """
    if already_ingested is None:
        already_ingested = {}

    
    pdf_files = list(Path(pdf_directory).glob("**/*.pdf"))
    print(f"Found {len(pdf_files)} PDF files")

    
    new_files_paths, skipped_files = filter_new_files(pdf_files, already_ingested)

   
    documents, new_files = load_pdfs(new_files_paths)

    
    chunks = split_documents(documents)

    return {
        "chunks":        chunks,
        "new_files":     new_files,
        "skipped_files": skipped_files,
    }