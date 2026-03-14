def clean_text(text: str) -> str:
    """Remove null bytes and strip whitespace from text."""
    if not text:
        return ""
    return text.replace("\x00", "").strip()