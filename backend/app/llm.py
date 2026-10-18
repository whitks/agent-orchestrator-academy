import os
import json
from dotenv import load_dotenv
from groq import AsyncGroq
from app.schemas import RouteDecision

load_dotenv(override=True)

def get_model():
    # Force reload to catch on-the-fly .env changes
    load_dotenv(override=True)
    return os.getenv("LLM_MODEL")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "mock_key")

client = AsyncGroq(api_key=GROQ_API_KEY)

async def call_router(query: str, memory_context: dict) -> RouteDecision:
    print(f"[LLM] Router using model: {get_model()}")
    prompt = f"""
    You are a query router for a college operations assistant. 
    Classify the query into zero or more domains: 'academics', 'placement', 'events', 'services'.
    
    Query: {query}
    Context: {json.dumps(memory_context)}
    
    Respond ONLY with a valid JSON object matching this schema:
    {{
        "domains": ["<domain1>"],
        "reasoning": "<why you chose these>",
        "is_multi_domain": false,
        "confidence": 0.9
    }}
    """
    
    response = await client.chat.completions.create(
        model=get_model(),
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    result = json.loads(response.choices[0].message.content)
    return RouteDecision(**result)

async def call_synthesizer(valid_results: list, failed_results: list) -> tuple[str, list[str]]:
    # Fallback default sources
    combined_sources = []
    for r in valid_results:
        combined_sources.extend(getattr(r, "sources", []) or [])
    combined_sources = list(dict.fromkeys(combined_sources)) # deduplicate preserve order

    # If no valid results at all
    if not valid_results:
        return "I could not find information in the official records for your query.", []

    prompt = f"""
    You are a synthesizer. Merge these valid answers into a single, cohesive, friendly response.
    If there are failed domains, politely mention that information was unavailable for that part.
    
    Valid Results: {json.dumps([r.model_dump() for r in valid_results])}
    Failed Results: {json.dumps([r.model_dump() for r in failed_results])}
    
    Output ONLY valid JSON with 'final_answer' and a list of 'sources'.
    Example:
    {{
        "final_answer": "...",
        "sources": ["file.md"]
    }}
    """
    
    try:
        response = await client.chat.completions.create(
            model=get_model(),
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        final_answer = result.get("final_answer", "").strip()
        sources = result.get("sources", [])
        if not sources:
            sources = combined_sources
        if final_answer:
            return final_answer, sources
    except Exception as e:
        print(f"[SYNTHESIZER LLM ERROR] {e}")

    # Deterministic fallback guardrail: merge valid answers directly
    fallback_parts = [r.answer for r in valid_results if r.answer]
    fallback_text = "\n\n".join(fallback_parts)
    return fallback_text, combined_sources

async def call_query_rewrite(history: list, summary: str, query: str) -> str:
    prompt = f"""
    Rewrite the user's latest query so it makes sense standalone, resolving pronouns from history.
    History: {json.dumps(history)}
    Summary: {summary}
    Latest Query: {query}
    
    Return ONLY the rewritten query text.
    """
    
    response = await client.chat.completions.create(
        model=get_model(),
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.choices[0].message.content.strip()

async def call_agent_llm(agent_name: str, system_prompt: str, query: str, context: str, sources: list, tool_calls: list):
    prompt = f"""
    {system_prompt}
    
    Context: {context}
    
    Query: {query}
    
    Respond ONLY with a valid JSON object matching this schema:
    {{
        "answer": "<your answer for the portion of the query covered by the context>",
        "status": "ok" or "insufficient_evidence",
        "confidence": 0.9
    }}
    Important: If the query has multiple parts and you can answer the part relevant to your domain from the context, answer it and set status to "ok". Only set status to "insufficient_evidence" if your context has zero information for your domain.
    """
    
    response = await client.chat.completions.create(
        model=get_model(),
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    from app.schemas import AgentResult
    result_dict = json.loads(response.choices[0].message.content)
    
    return AgentResult(
        agent_name=agent_name,
        answer=result_dict.get("answer", "Error generating answer"),
        status=result_dict.get("status", "error"),
        confidence=result_dict.get("confidence", 0.0),
        sources=sources,
        tool_calls=tool_calls
    )
