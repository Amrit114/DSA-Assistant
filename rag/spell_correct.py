from spellchecker import SpellChecker

spell = SpellChecker()

DSA_KEYWORDS = {
    "dsa":           "data structures algorithms",
    "technic":       "technique",
    "techniq":       "technique",
    "tecnique":      "technique",
    "algorythm":     "algorithm",
    "sortin":        "sorting",
    "sortng":        "sorting",
    "searchin":      "searching",
    "complxity":     "complexity",
    "recusion":      "recursion",
    "recurison":     "recursion",
    "dynmic":        "dynamic",
    "progaming":     "programming",
    "travarsal":     "traversal",
    "traveral":      "traversal",
    "diferent":      "difference",
    "diffrence":     "difference",
    "diference":     "difference",
}


def correct_query(question: str) -> str:
    """Fix common spelling mistakes before searching."""
    words     = question.lower().split()
    corrected = []
    for word in words:
        
        if word.isdigit() or len(word) <= 2:
            corrected.append(word)
            continue
        
        if word in DSA_KEYWORDS:
            corrected.append(DSA_KEYWORDS[word])
            continue
        
        fixed = spell.correction(word)
        corrected.append(fixed if fixed else word)
    return " ".join(corrected)