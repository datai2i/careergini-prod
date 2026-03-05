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
        self.model_name = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
        # Reduced threads to 4 for legacy CPU to avoid synchronization overhead
        num_threads = 4
        
        logger.info(f"Initializing Haystack Ollama client with base_url: {self.base_url}")
        
        # Model 1: Complex Reasoning (Supervisor, Resume Builder)
        self.generator_reasoning = OllamaGenerator(
            model=self.model_name,
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
        logger.info(f"✓ Loaded reasoning model generator: {self.model_name}")
        
        # Model 2: Fast Tasks (Profile, Jobs, Learning)
        self.generator_fast = OllamaGenerator(
            model=self.model_name,
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
        logger.info(f"✓ Loaded fast model generator: {self.model_name}")
        
        # Model 3: Technical/Coding Tasks (Skills Gap)
        self.generator_coder = OllamaGenerator(
            model=self.model_name,
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
        logger.info(f"✓ Loaded coder model generator: {self.model_name}")
    
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

    async def ensure_model(self) -> bool:
        """
        Ensure the required inference model exists in the Ollama container.
        If missing (e.g. after a docker-compose down -v), automatically pull it.
        """
        try:
            import httpx
            import asyncio
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Check if model exists
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    installed_models = [m["name"] for m in models]
                    
                    if self.model_name in installed_models or f"{self.model_name}:latest" in installed_models:
                        logger.info(f"✓ Required model '{self.model_name}' is already installed.")
                        return True
                    
                    # Model is missing, begin pull
                    logger.warning(f"⚠ Required model '{self.model_name}' is missing from Ollama. Auto-pulling now...")
                    
                    pull_payload = {"name": self.model_name}
                    
                    # We use a longer timeout for the stream response
                    async with httpx.AsyncClient(timeout=600.0) as pull_client:
                        async with pull_client.stream("POST", f"{self.base_url}/api/pull", json=pull_payload) as r:
                            r.raise_for_status()
                            async for line in r.aiter_lines():
                                if line:
                                    try:
                                        import json
                                        data = json.loads(line)
                                        status = data.get("status", "Downloading")
                                        # Only log major state changes, skip spammy progress outputs
                                        if "pulling" not in status.lower() and status:
                                            logger.info(f"Ollama Pull: {status}")
                                    except:
                                        pass
                    
                    logger.info(f"✅ Successfully pulled {self.model_name}")
                    return True
                else:
                    logger.error(f"Failed to fetch installed models. Status: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Failed to ensure model {self.model_name}: {e}")
            return False

# Global singleton instance
_ollama_client = None

def get_ollama_client() -> OllamaClient:
    """Get or create global Ollama client instance"""
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client
