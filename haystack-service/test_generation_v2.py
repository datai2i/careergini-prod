import asyncio
import os
import json
import io
import PyPDF2
from haystack_integrations.components.generators.ollama import OllamaGenerator
from agents.resume_advisor_agent import ResumeAdvisorAgent
from pdf_generator import generate_pdf

async def main():
    agent = ResumeAdvisorAgent(OllamaGenerator(model="qwen2.5:1.5b", url="http://careergini-ollama:11434"))
    
    file_path = "/app/Bugs_Resumes/Orginal_Bheemeswararao_Aika_Profile.pdf"
    
    jd = """
    We are looking for a Senior Software Engineer with strong experience in software development and full stack technologies.
    You will be responsible for building scalable web applications and collaborating with cross-functional teams.
    """
    
    print(f"\\n{'='*50}\\nTesting: {file_path}\\n{'='*50}")
    try:
        with open(file_path, "rb") as f:
            content = f.read()
            
        print("Extracting text...")
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
        print("\\nPERSONA EXTRACTED:")
        print("Name:", persona.get("full_name"))
        print("Skills count:", len(persona.get("top_skills", [])))
        
        print("\\nTailoring resume...")
        result = await agent.tailor_resume(
            persona=persona,
            job_description=jd,
            target_industry="Technology",
            focus_area="Software Development",
            template="professional"
        )
        
        tailored = result.get("tailored_result", {})
        print("Cover Letter snippet:", tailored.get("cover_letter", "")[:100])
        print("Tailored Skills:", len(tailored.get("tailored_skills", [])))
        
        out_pdf = "/app/Bugs_Resumes/Bheemeswararao_Patched_2Page.pdf"
        print(f"\\nGenerating 2-page PDF: {out_pdf}")
        generate_pdf(out_pdf, tailored, template="professional", page_count=2)
        print("PDF Generation complete!")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
