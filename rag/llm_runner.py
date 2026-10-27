import re
from llm.groq_llm import get_llm
from rag.prompt import PROMPT

llm = get_llm()

REFUSAL = "I could not find information about this in the indexed textbooks."


def _is_refusal(answer: str) -> bool:
    """
    True when the answer is only the refusal (plus maybe a Source section).
    A real answer that mentions the refusal for one part of the question is kept.
    """
    if REFUSAL not in answer:
        return False
    rest = answer.replace(REFUSAL, "")
    rest = re.split(r"^\s*#*\s*\**sources?\b", rest, flags=re.IGNORECASE | re.MULTILINE)[0]
    return len(re.sub(r"[\W_]+", "", rest)) < 40


def run_llm(context: str, question: str) -> str:
    """
    Sends context + question to the LLM and returns the answer.
    If the LLM only refused, returns the clean refusal — no hallucinated Source section.
    """
    prompt   = PROMPT.format(context=context, question=question)
    response = llm.invoke(prompt)
    answer   = response.content

    if _is_refusal(answer):
        return REFUSAL

    return answer
