from llm.groq_llm import get_llm
from rag.prompt import PROMPT

llm = get_llm()

REFUSAL = "I could not find information about this in the indexed textbooks."


def run_llm(context: str, question: str) -> str:
    """
    Sends context + question to the LLM and returns the answer.
    If the LLM includes a refusal message, strips everything else
    and returns only the clean refusal — no hallucinated Source section.
    """
    prompt   = PROMPT.format(context=context, question=question)
    response = llm.invoke(prompt)
    answer   = response.content

    # If LLM said it couldn't find info, return clean refusal only
    if REFUSAL in answer:
        return REFUSAL

    return answer