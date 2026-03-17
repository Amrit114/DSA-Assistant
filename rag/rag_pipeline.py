from db.vector_store import similarity_search
from rag.spell_correct import correct_query
from rag.llm_runner import run_llm

REFUSAL = "I could not find information about this in the indexed textbooks."


def rag_answer(question: str) -> str:
    
    corrected_question = correct_query(question)

    
    context = similarity_search(corrected_question)

    
    if not context or not context.strip():
        return REFUSAL

    
    return run_llm(context, question)