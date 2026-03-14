import hashlib


def get_file_hash(filepath: str) -> str:
    """Generate MD5 hash of file contents to detect duplicates."""
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()