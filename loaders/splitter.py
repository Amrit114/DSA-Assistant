from langchain_text_splitters import RecursiveCharacterTextSplitter


splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100
)


def split_documents(documents: list) -> list:
    """Split loaded PDF pages into smaller chunks for embedding."""
    return splitter.split_documents(documents)