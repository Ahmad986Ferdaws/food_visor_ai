"""Agent 2 — Recommender.

Uses Agent 1 context + RAG retrieval from vector DB to generate recommendations.
This is the ONLY agent that uses vector retrieval.
"""

from app.agents.base import BaseAgent, AgentInput, AgentOutput
from app.config import get_settings
from app.services.rag import search_similar_chunks

settings = get_settings()


class RecommenderAgent(BaseAgent):
    name = "recommender"

    def run(self, inp: AgentInput) -> AgentOutput:
        self._log(f"Generating recommendations for interaction={inp.interaction_id}")

        context = inp.context or {}
        message = context.get("message", inp.message)

        # ── RAG retrieval (Agent 2 exclusive) ───────────
        try:
            retrieved = search_similar_chunks(query=message, top_k=5)
            self._log(f"Retrieved {len(retrieved)} chunks from vector DB")
        except Exception as e:
            self._log(f"RAG retrieval failed, continuing without: {e}", level="warning")
            retrieved = []

        # ── LLM call (stub) ─────────────────────────────
        # TODO: Replace with actual LLM call using settings.AGENT2_API_KEY
        recommendations = {
            "items": [
                {
                    "title": "Sample Recommendation 1",
                    "description": "Based on your preferences and context",
                    "confidence": 0.85,
                    "sources": [c.get("chunk_id") for c in retrieved[:2]],
                },
                {
                    "title": "Sample Recommendation 2",
                    "description": "Alternative option",
                    "confidence": 0.72,
                    "sources": [c.get("chunk_id") for c in retrieved[2:4]],
                },
            ],
            "reasoning": f"Generated from {len(retrieved)} retrieved sources and user context.",
            "retrieval_count": len(retrieved),
        }

        self._log("Recommendations generated")
        return AgentOutput(success=True, data=recommendations)
