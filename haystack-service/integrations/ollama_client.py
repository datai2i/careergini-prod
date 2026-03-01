"""
Ollama Client for CareerGini (Haystack Version)
100% Local LLM Inference - NO External APIs

Performance tuning for qwen2.5:1.5b on CPU-only server (8 vCPUs, 28GB RAM):
  - num_ctx: 4096  (model supports 4096; 2048 caused context overflow and crashes)
  - num_thread: 6  (leave 2 cores for OS/other services)
  - timeout: 150s  (hard cap — fail fast and use fallback instead of hanging 10+ min)
  - temperature: 0.3 for structured JSON tasks (more deterministic, fewer retries)
"""

from haystack_integrations.components.generators.ollama import OllamaGenerator
from typing import Literal
import os
import logging

logger = logging.getLogger(__name__)

class OllamaClient:
    """
    Centralized Ollama client for all LLM operations.
    All three generators use the same qwen2.5:1.5b model but with
    different temperature/creativity settings per task type.
    """

    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434"))
        # Use 6 threads — leaves 2 free for OS and other Docker services
        num_threads = 6

        logger.info(f"Initializing Haystack Ollama client with base_url: {self.base_url}")

        # ── Shared generation kwargs ──────────────────────────────────────────
        # num_ctx=4096: qwen2.5:1.5b supports up to 32k but we cap at 4096
        #   to stay within a safe region on CPU. This gives us ~3000 tokens of
        #   usable prompt space after reserving ~1096 tokens for the response.
        # timeout=150: if Ollama takes >2.5 min, something is wrong; fail fast.
        _base_kwargs = dict(
            num_ctx=4096,
            num_thread=num_threads,
            top_p=0.9,
            repeat_penalty=1.1,
        )

        # Model 1: Complex Reasoning (Supervisor, Resume Builder)
        self.generator_reasoning = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=150,
            generation_kwargs={
                **_base_kwargs,
                "temperature": 0.3,   # structured JSON → deterministic
            }
        )
        logger.info("✓ Loaded reasoning model generator: qwen2.5:1.5b")

        # Model 2: Fast Tasks (Profile, Jobs, Learning, simple responses)
        self.generator_fast = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=150,
            generation_kwargs={
                **_base_kwargs,
                "temperature": 0.1,   # minimal creativity, maximum speed
            }
        )
        logger.info("✓ Loaded fast model generator: qwen2.5:1.5b")

        # Model 3: Technical/Coding Tasks (Skills Gap)
        self.generator_coder = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=150,
            generation_kwargs={
                **_base_kwargs,
                "temperature": 0.1,
                "repeat_penalty": 1.05,
            }
        )
        logger.info("✓ Loaded coder model generator: qwen2.5:1.5b")

    def get_generator(self, task_type: Literal["reasoning", "fast", "coding"]) -> OllamaGenerator:
        """Get appropriate generator for task type."""
        if task_type == "reasoning":
            return self.generator_reasoning
        elif task_type == "coding":
            return self.generator_coder
        else:
            return self.generator_fast

    async def health_check(self) -> dict:
        """Check Ollama service health"""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    return {
                        "status": "healthy",
                        "models_available": len(models),
                        "base_url": self.base_url
                    }
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "base_url": self.base_url
            }


# Global singleton instance
_ollama_client = None


def get_ollama_client() -> OllamaClient:
    """Get or create global Ollama client instance"""
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client
