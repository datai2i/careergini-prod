"""
Ollama Client for CareerGini (Haystack Version)
100% Local LLM Inference - NO External APIs
"""

from haystack_integrations.components.generators.ollama import OllamaGenerator
from typing import Literal
import os
import logging

logger = logging.getLogger(__name__)

class OllamaClient:
    """
    Centralized Ollama client for all LLM operations.
    Supports three model types for different task complexities.
    """
    
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        # Reduced threads to 4 for legacy CPU to avoid synchronization overhead
        num_threads = 4
        
        logger.info(f"Initializing Haystack Ollama client with base_url: {self.base_url}")
        
        # Model 1: Complex Reasoning (Supervisor, Resume Builder)
        self.generator_reasoning = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=1200,
            generation_kwargs={
                "temperature": 0.7,
                "num_ctx": 2048, # Reduced from 4096
                "num_thread": num_threads,
                "top_p": 0.9,
                "repeat_penalty": 1.1
            }
        )
        logger.info("✓ Loaded reasoning model generator: qwen2.5:1.5b")
        
        # Model 2: Fast Tasks (Profile, Jobs, Learning)
        self.generator_fast = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=1200,
            generation_kwargs={
                "temperature": 0.1, # Lowered for more determinism and speed
                "num_ctx": 2048, # Reduced from 4096
                "num_thread": num_threads,
                "top_p": 0.9,
                "repeat_penalty": 1.0
            }
        )
        logger.info("✓ Loaded fast model generator: qwen2.5:1.5b")
        
        # Model 3: Technical/Coding Tasks (Skills Gap)
        self.generator_coder = OllamaGenerator(
            model="qwen2.5:1.5b",
            url=self.base_url,
            timeout=1200,
            generation_kwargs={
                "temperature": 0.1,
                "num_ctx": 2048,
                "num_thread": num_threads,
                "top_p": 0.9,
                "repeat_penalty": 1.05
            }
        )
        logger.info("✓ Loaded coder model generator: qwen2.5:1.5b")
    
    def get_generator(self, task_type: Literal["reasoning", "fast", "coding"]) -> OllamaGenerator:
        """
        Get appropriate generator for task type.
        """
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
