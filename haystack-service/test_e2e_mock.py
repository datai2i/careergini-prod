from agents.resume_advisor_agent import ResumeAdvisorAgent
import asyncio
import json

async def test_e2e():
    agent = ResumeAdvisorAgent()
    
    jd = "Seeking a Senior Software Engineer with strong experience in Python, Kubernetes, and React. Must be able to lead teams."
    persona = {
        "full_name": "Jane Doe",
        "professional_title": "Backend Engineer",
        "email": "jane@example.com",
        "summary": "Experienced backend developer.",
        "top_skills": ["Python", "Django", "SQL"],
        "experience_highlights": [
            {
                "role": "Software Developer",
                "company": "Startup Inc",
                "duration": "2020 - Present",
                "key_achievement": ["Built APIs with Python and Django.", "Managed SQL databases."]
            }
        ],
        "education": []
    }
    
    print("Running tailor...")
    result = await agent.tailor(persona, jd, tone="professional", sector="software")
    print(json.dumps(result, indent=2))
    print("\n--- GAP ANALYSIS FROM AI ---")
    print(result.get('gap_analysis', []))
    
    print("\nRunning finalize (compact)...")
    final_result_compact = await agent.finalize(result, "professional", 1)
    print("Compact Word Count constraint applied.")
    
    print("\nRunning finalize (detailed)...")
    final_result_detailed = await agent.finalize(result, "executive", 2)
    print("Detailed Word Count constraint applied.")

    from docx_generator import generate_resume_docx
    from pdf_generator import generate_pdf
    
    print("\nTesting PDF 1-page generation (LaTeX)...")
    generate_pdf("e2e_1.pdf", final_result_compact, "professional", page_count=1)
    
    print("\nTesting DOCX 1-page generation...")
    generate_resume_docx("e2e_1.docx", final_result_compact, "professional", page_count=1)

if __name__ == "__main__":
    asyncio.run(test_e2e())
