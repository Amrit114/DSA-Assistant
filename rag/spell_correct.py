import re
from spellchecker import SpellChecker

spell = SpellChecker()

# Real DSA vocabulary the general-English dictionary doesn't know; without this
# "heapify" → "heavily", "memoization" → "memorization", "kruskal" → "crucial".
DSA_VOCABULARY = """
    heapify heapsort quicksort mergesort timsort shellsort introsort radix counting bucket
    memoization memoize memoized tabulation backtracking bitmask bitmasking greedy
    dijkstra dijkstras kruskal kruskals prim prims bellman ford floyd warshall kosaraju tarjan
    johnson kahn huffman knuth morris pratt rabin karp boyer moore manacher kadane kadanes
    bfs dfs avl bst bsts mst dag dags lcs lis lru lfu kmp dsu nlogn logn
    trie tries treap treaps splay skiplist hashmap hashmaps hashtable hashtables hashset
    linkedlist deque deques enqueue dequeue minheap maxheap priorityqueue
    inorder preorder postorder levelorder topological toposort subarray subarrays
    subsequence subsequences substring substrings subtree subtrees subproblem subproblems
    amortized asymptotic recurrence recursion recursive iterative pseudocode
    adjacency vertices vertex digraph bipartite spanning unweighted acyclic
    pivot partitioning lomuto hoare sentinel
""".split()
spell.word_frequency.load_words(DSA_VOCABULARY)

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
    for token in words:
        # Look up the word without surrounding punctuation ("dfs?" → "dfs").
        lead, word, trail = re.match(r"^(\W*)(.*?)(\W*)$", token).groups()

        if word in DSA_KEYWORDS:
            corrected.append(lead + DSA_KEYWORDS[word] + trail)
            continue

        # Short words are mostly acronyms (bfs, dfs, avl, lcs); only plain words get corrected.
        if len(word) <= 3 or not word.isalpha():
            corrected.append(token)
            continue

        fixed = spell.correction(word)
        corrected.append(lead + (fixed or word) + trail)
    return " ".join(corrected)