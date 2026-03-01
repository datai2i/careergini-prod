import asyncio
from agents.resume_advisor_agent import ResumeAdvisorAgent
from haystack_integrations.components.generators.ollama import OllamaGenerator
import json

async def run_test():
    generator = OllamaGenerator(model="qwen2.5:1.5b", url="http://ollama:11434")
    agent = ResumeAdvisorAgent(generator)
    
    persona = {
        "full_name": "Jane Doe",
        "professional_title": "Backend Builder",
        "summary": "Building REST APIs.",
        "top_skills": ["Python", "FastAPI"]
    }
    job_description = "We need a React and Node.js developer."
    
    print("Running tailored component...")
    result = await agent.tailor_resume(persona, job_description, "software", "frontend", "professional")
    
    print("\n\nFinal Tailored Dictionary:")
    print(json.dumps(result, indent=2))
    print("\nGap Analysis Exists?", "gap_analysis" in result)

if __name__ == "__main__":
    asyncio.run(run_test())
