from db.vector_store import similarity_search
from rag.spell_correct import correct_query
from rag.llm_runner import run_llm

REFUSAL = "I could not find information about this in the indexed textbooks."


def rag_answer(question: str) -> str:
    # Step 1 — Fix spelling before searching
    corrected_question = correct_query(question)

    # Step 2 — Search using corrected question
    context = similarity_search(corrected_question)

    # Step 3 — If DB returned nothing, refuse immediately (no LLM call)
    if not context or not context.strip():
        return REFUSAL

    # Step 4 — Run LLM with original question for display
    return run_llm(context, question)