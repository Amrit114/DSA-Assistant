from langchain_community.document_loaders import PyMuPDFLoader
from loaders.hasher import get_file_hash


def load_pdfs(pdf_files: list) -> tuple:
    """
    Loads each PDF file using PyMuPDFLoader.
    Tags every page with source_file, source_path and file_hash metadata.

    Returns:
        all_documents — list of loaded pages
        new_files     — list of successfully loaded filenames
    """
    all_documents = []
    new_files     = []

    for pdf_file in pdf_files:
        filename  = pdf_file.name
        file_hash = get_file_hash(str(pdf_file))

        try:
            loader    = PyMuPDFLoader(str(pdf_file))
            documents = loader.load()

            for doc in documents:
                doc.metadata["source_file"] = filename
                doc.metadata["source_path"] = str(pdf_file)
                doc.metadata["file_hash"]   = file_hash

            all_documents.extend(documents)
            new_files.append(filename)

        except Exception as e:
            print(f"Error loading {filename}: {e}")

    return all_documents, new_files