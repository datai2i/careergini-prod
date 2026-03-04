import asyncio
import os
import json
import io
import PyPDF2
from haystack_integrations.components.generators.ollama import OllamaGenerator
from agents.resume_advisor_agent import ResumeAdvisorAgent

async def main():
    agent = ResumeAdvisorAgent(OllamaGenerator(model="qwen2.5:1.5b", url="http://careergini-ollama:11434"))
    
    test_files = [
        "/app/Test_Resumes/Komal_Frontend_5yr.pdf",
        "/app/Test_Resumes/Musunuru Vishnu vardhan ..pdf",
        "/app/Test_Resumes/PurushottamaKavya_Resume.pdf",
        "/app/Test_Resumes/Pyla_Sandeep_AI_ML_Engineer.pdf",
        "/app/Test_Resumes/Sravani_SDE_Resume-2.pdf"
    ]
    
    jd = """
    We are looking for a Senior Software Engineer with strong experience in React, Node.js, and cloud platforms.
    You will be responsible for building scalable web applications and collaborating with cross-functional teams.
    Experience with Agile methodologies and CI/CD pipelines is a plus.
    """
    
    for file_path in test_files:
        print(f"\\n{'='*50}\\nTesting: {file_path}\\n{'='*50}")
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            
            text = ""
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\\n"
            except Exception as e:
                print(f"pdfplumber failed: {e}, falling back to PyPDF2")
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\\n"
            
            print("Extracted text length:", len(text))
            
            print("Extracting persona...")
            persona = await agent.extract_persona(text)
            
            print("Tailoring resume...")
            result = await agent.tailor_resume(
                persona=persona,
                job_description=jd,
                target_industry="Technology",
                focus_area="Full Stack Development"
            )
            
            # Verify bullets
            has_dict = False
            for exp in result.get('tailored_experience', []):
                bullets = exp.get('tailored_bullets', [])
                for b in bullets:
                    if isinstance(b, dict):
                        print("ERROR: Found dictionary in bullets:", b)
                        has_dict = True
                    elif isinstance(b, str) and "{" in b and "action" in b:
                        print("ERROR: Found stringified dictionary in bullets:", b)
                        has_dict = True
            
            if not has_dict:
                print("SUCCESS: All bullet points are cleanly formatted strings!")
                print("Sample experience:", json.dumps(result.get('tailored_experience', [])[:1], indent=2))
        except Exception as e:
            print(f"FAILED on {file_path}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
