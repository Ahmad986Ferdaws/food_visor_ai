"""Base class for all agents. Each agent is a stateless callable."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class AgentInput:
    interaction_id: str
    user_id: str
    message: str
    context: dict | None = None
    sensitive_mode: bool = False


@dataclass
class AgentOutput:
    success: bool
    data: dict[str, Any]
    error: str | None = None


class BaseAgent(ABC):
    """All agents implement run(). They read/write DB state but never call other agents."""

    name: str = "base"

    @abstractmethod
    def run(self, inp: AgentInput) -> AgentOutput:
        ...

    def _log(self, msg: str, level: str = "info"):
        getattr(logger, level)(f"[{self.name}] {msg}")
