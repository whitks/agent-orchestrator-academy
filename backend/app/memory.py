from typing import List, Dict, Any, Optional

class MemoryStore:
    def __init__(self, max_turns: int = 2):
        self.store: Dict[str, Dict[str, Any]] = {}
        self.max_turns = max_turns
        
    def _get_session(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self.store:
            self.store[session_id] = {"history": [], "summary": ""}
        return self.store[session_id]
        
    def clear_session(self, session_id: str):
        if session_id in self.store:
            del self.store[session_id]
        
    def add_turn(self, session_id: str, user_msg: str, assistant_msg: str):
        session = self._get_session(session_id)
        session["history"].append({"role": "user", "content": user_msg})
        session["history"].append({"role": "assistant", "content": assistant_msg})
        
        # Enforce max turns (1 turn = 2 messages)
        while len(session["history"]) > self.max_turns * 2:
            self._summarize_oldest(session)
            
    def _summarize_oldest(self, session: dict):
        oldest_user = session["history"].pop(0)
        oldest_assistant = session["history"].pop(0)
        
        old_summary = session.get("summary", "")
        # For a real implementation, we'd use an LLM here to intelligently summarize
        new_info = f"User asked: {oldest_user['content']} | Assistant replied: {oldest_assistant['content']}"
        session["summary"] = f"{old_summary} {new_info}".strip()
        
    def get_context(self, session_id: str) -> Dict[str, Any]:
        session = self._get_session(session_id)
        return {
            "history": list(session["history"]),
            "summary": session["summary"]
        }
        
    async def rewrite_query(self, session_id: str, query: str) -> str:
        session = self._get_session(session_id)
        if not session["history"]:
            return query
            
        return await self._llm_rewrite(session["history"], session["summary"], query)
        
    async def _llm_rewrite(self, history: list, summary: str, query: str) -> str:
        from app.llm import call_query_rewrite
        return await call_query_rewrite(history, summary, query)
