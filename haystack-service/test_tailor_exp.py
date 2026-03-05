import asyncio
from integrations.ollama_client import get_ollama_client
import json

async def test():
    ollama = get_ollama_client()
    gen = ollama.get_generator("reasoning")
    prompt = """You are an expert resume writer. Rewrite the bullet points for the following 1 roles to explicitly target the provided Job Description.

CRITICAL RULES (MUST FOLLOW):
- You MUST output ALL 1 items provided below. Do NOT drop any IDs.
- Keep the exact "id" for each role in your output.
- ONLY rewrite the bullet points. Generate 4-6 rich STAR bullets per role (Action Verb + task + quantified result).
- Each bullet MUST be a plain string.
- Output ONLY valid JSON.

Roles to Rewrite (preserve ALL IDs):
[
  {
    "id": 0,
    "bullets": [
      "Software Developer at ABC."
    ]
  }
]

Job Description:
Looking for a Senior Software Engineer with Python and AI skills.

Required JSON (output ALL 1 items):
{
  "tailored_bullets": [
    {"id": 0, "bullets": ["STAR bullet 1", "STAR bullet 2"]}
  ]
}"""
    print("Running LLM...")
    res = gen.run(prompt=prompt)
    print("Response:::")
    print(res["replies"][0])

if __name__ == "__main__":
    asyncio.run(test())
