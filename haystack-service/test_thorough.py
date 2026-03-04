"""
Thorough end-to-end resume generation test.
Dumps raw data at EVERY step to diagnose issues.
"""
import asyncio
import os
import json
import io
import PyPDF2
from haystack_integrations.components.generators.ollama import OllamaGenerator
from agents.resume_advisor_agent import ResumeAdvisorAgent, _sanitize_dict, _sanitize_bullets_list
from pdf_generator import generate_pdf

def dump(label, data):
    """Pretty-print a data object with a label."""
    print(f"\n{'─'*60}")
    print(f"📋 {label}")
    print(f"{'─'*60}")
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, list):
                print(f"  {k}: [{len(v)} items]")
                for i, item in enumerate(v[:3]):
                    print(f"    [{i}] {str(item)[:120]}")
            elif isinstance(v, str) and len(v) > 200:
                print(f"  {k}: {v[:200]}...")
            else:
                print(f"  {k}: {v}")
    else:
        print(f"  {data}")

async def main():
    print("="*60)
    print("THOROUGH RESUME GENERATION TEST")
    print("="*60)

    # Step 1: Extract text
    file_path = "/app/Bugs_Resumes/Orginal_Bheemeswararao_Aika_Profile.pdf"
    print(f"\n📄 Reading: {file_path}")
    
    with open(file_path, "rb") as f:
        content = f.read()
    
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"pdfplumber failed: {e}")
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
    
    print(f"✅ Extracted {len(text)} chars of text")
    print(f"   First 300 chars: {text[:300]}")

    # Step 2: Extract persona
    print("\n\n🔍 STEP 2: Extracting persona...")
    agent = ResumeAdvisorAgent(OllamaGenerator(
        model="qwen2.5:1.5b", 
        url="http://careergini-ollama:11434",
        timeout=300
    ))
    
    persona = await agent.extract_persona(text)
    dump("EXTRACTED PERSONA", persona)

    # Step 3: Tailor resume
    jd = """We are looking for a Senior Software Engineer with 5+ years of experience 
    in full stack development. Required skills: React, Angular, Node.js, Python,
    AWS/Azure cloud platforms, CI/CD pipelines, Agile/Scrum methodology."""

    print("\n\n🔍 STEP 3: Tailoring resume...")
    try:
        tailored = await agent.tailor_resume(
            persona=persona,
            job_description=jd,
            target_industry="Technology",
            focus_area="Full Stack Development",
            template="professional"
        )
        dump("TAILORED RESULT", tailored)
    except Exception as e:
        print(f"❌ Tailoring FAILED: {e}")
        tailored = {}

    # Step 4: Check what the PDF generator will actually receive
    print("\n\n🔍 STEP 4: Checking PDF input data...")
    pdf_persona = dict(tailored) if tailored else dict(persona)
    
    # Check critical fields
    has_name = bool(pdf_persona.get("full_name"))
    has_summary = bool(pdf_persona.get("summary") or pdf_persona.get("tailored_summary"))
    has_skills = bool(pdf_persona.get("top_skills") or pdf_persona.get("tailored_skills"))
    has_exp = bool(pdf_persona.get("experience_highlights") or pdf_persona.get("tailored_experience"))
    
    print(f"  has full_name:    {has_name} → {pdf_persona.get('full_name', 'MISSING')}")
    print(f"  has summary:      {has_summary}")
    print(f"  has skills:       {has_skills} → count={len(pdf_persona.get('top_skills', pdf_persona.get('tailored_skills', [])))}")
    print(f"  has experience:   {has_exp} → count={len(pdf_persona.get('experience_highlights', pdf_persona.get('tailored_experience', [])))}")
    print(f"  has education:    {bool(pdf_persona.get('education'))}")
    print(f"  has certs:        {bool(pdf_persona.get('certifications'))}")

    if not has_name and not has_summary and not has_skills:
        print("\n⚠️  WARNING: PDF persona is EMPTY — tailoring returned nothing!")
        print("   Falling back to raw extracted persona for PDF generation...")
        pdf_persona = dict(persona)
        # Map persona fields to tailored field names
        pdf_persona["tailored_summary"] = persona.get("summary", "")
        pdf_persona["tailored_skills"] = persona.get("top_skills", [])
        pdf_persona["tailored_experience"] = persona.get("experience_highlights", [])

    dump("FINAL PDF INPUT DATA", pdf_persona)

    # Step 5: Generate PDFs
    print("\n\n🔍 STEP 5: Generating PDFs...")
    
    out_2p = "/app/Bugs_Resumes/Test_Patched_2Page.pdf"
    out_1p = "/app/Bugs_Resumes/Test_Patched_1Page.pdf"
    
    try:
        generate_pdf(out_2p, pdf_persona, template="professional", page_count=2)
        size_2p = os.path.getsize(out_2p)
        print(f"✅ 2-page PDF: {out_2p} ({size_2p} bytes)")
    except Exception as e:
        print(f"❌ 2-page PDF FAILED: {e}")

    try:
        generate_pdf(out_1p, pdf_persona, template="professional", page_count=1)
        size_1p = os.path.getsize(out_1p)
        print(f"✅ 1-page PDF: {out_1p} ({size_1p} bytes)")
    except Exception as e:
        print(f"❌ 1-page PDF FAILED: {e}")
    
    print("\n\n✅ TEST COMPLETE")

if __name__ == "__main__":
    asyncio.run(main())
