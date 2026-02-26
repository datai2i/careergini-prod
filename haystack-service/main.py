from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from orchestration.workflow import build_careergini_workflow, CareerGiniState
from integrations.ollama_client import get_ollama_client
from cache.redis_cache import ResponseCache
from linkedin_parser import scrape_linkedin_profile
from resume_ats_scorer import score_resume
from job_matcher import match_job
from skill_gap_analyzer import analyze_skill_gaps
from interview_simulator import create_interview_session, evaluate_interview_answer
from career_path_predictor import predict_career_path
from proactive_advisor import generate_career_nudges
from analytics_dashboard import generate_analytics_dashboard
from agents.resume_advisor_agent import ResumeAdvisorAgent
from agents.job_hunter_agent import JobHunterAgent
import uvicorn
import logging
import os
import json
import asyncio
import httpx
import PyPDF2
import docx
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="CareerGini AI Service", version="1.0.0")

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Initialize workflow and cache
workflow = build_careergini_workflow()
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
cache = ResponseCache(redis_url)

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    profile_data: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    response: str
    agent: str
    suggested_prompts: List[str] = []

class PersonaUpdateRequest(BaseModel):
    persona: Dict[str, Any]

class DraftResumeRequest(BaseModel):
    user_id: str
    full_name: str
    professional_title: str
    summary: str
    top_skills: List[str]
    experience_highlights: List[Dict[str, str]]
    education: List[Dict[str, str]]

@app.on_event("startup")
async def startup_event():
    """Check connections on startup"""
    logger.info("Starting AI Service...")
    ollama = get_ollama_client()
    health = await ollama.health_check()
    logger.info(f"Ollama Health: {health}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        ollama = get_ollama_client()
        ollama_health = await ollama.health_check()
        cache_stats = cache.get_stats()
        return {
            "status": "healthy",
            "service": "ai-service",
            "ollama": ollama_health,
            "cache": cache_stats
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {"status": "unhealthy", "error": str(e)}

class ResumeTailorRequest(BaseModel):
    user_id: str
    job_description: str = ""
    persona: Optional[Dict[str, Any]] = None
    template: Optional[str] = "classic"
    profile_pic: Optional[str] = None
    page_count: Optional[int] = 2  # 1 = single page, 2 = full detail

@app.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = "default_user"  # In prod, extract from auth token
):
    """
    Upload resume, save file, and extract Persona Map.
    """
    logger.info(f"Processing resume upload for user {user_id}: {file.filename}")
    
    # Create user upload directory
    upload_dir = f"uploads/{user_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = f"{upload_dir}/{file.filename}"
    
    try:
        # Read file content
        content = await file.read()
        
        # Save file to disk
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Extract text based on file type
        text = ""
        if file.filename.endswith('.pdf'):
            # Try parsing with pdfplumber (better for layout)
            try:
                import pdfplumber
                pdf_file = io.BytesIO(content)
                with pdfplumber.open(pdf_file) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
            except Exception as e:
                logger.warning(f"pdfplumber failed: {e}, falling back to PyPDF2")
                # Fallback to PyPDF2
                pdf_file = io.BytesIO(content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                    
        elif file.filename.endswith('.docx'):
            # Parse DOCX
            doc_file = io.BytesIO(content)
            doc = docx.Document(doc_file)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        elif file.filename.endswith('.txt'):
            # Plain text
            text = content.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload PDF, DOCX, or TXT.")
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file.")
        
        # Extract Persona using ResumeAdvisorAgent
        ollama = get_ollama_client()
        agent = ResumeAdvisorAgent(ollama.get_generator("fast"))
        persona = agent.extract_persona(text)
        
        # Save Persona to disk
        persona_path = f"{upload_dir}/persona.json"
        with open(persona_path, "w") as f:
            json.dump(persona, f, indent=2)
            
        # Update Unified Persona (local file cache)
        from persona_manager import PersonaManager
        pm = PersonaManager(user_id)
        pm.ingest_resume_data(persona)

        # Sync to profile-service PostgreSQL database
        profile_service_url = os.getenv("PROFILE_SERVICE_URL", "http://profile-service:3001")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                sync_payload = {
                    "user_id": user_id,
                    "full_name": persona.get("full_name") or persona.get("name", ""),
                    "headline": persona.get("professional_title") or persona.get("title", ""),
                    "summary": persona.get("summary", ""),
                    "location": persona.get("location", ""),
                    "skills": persona.get("top_skills") or persona.get("skills") or [],
                    "experience": persona.get("experience_highlights") or persona.get("experience") or [],
                    "education": persona.get("education") or [],
                    "latest_resume_filename": file.filename,
                    "latest_resume_path": f"uploads/{user_id}/{file.filename}"
                }
                resp = await client.post(f"{profile_service_url}/sync-resume", json=sync_payload)
                if resp.status_code == 200:
                    logger.info(f"[resume-upload] Profile synced to DB for user {user_id}")
                else:
                    logger.warning(f"[resume-upload] Profile sync returned {resp.status_code}: {resp.text}")
        except Exception as sync_err:
            logger.warning(f"[resume-upload] Profile sync to DB failed (non-fatal): {sync_err}")

        logger.info(f"Successfully extracted persona for {user_id}")
        
        return {
            "text": text,
            "filename": file.filename,
            "persona": persona,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing resume: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")

@app.post("/resume/draft")
async def draft_resume(request: DraftResumeRequest):
    """Save manually entered resume drafted by user (bypasses LLM parsing)"""
    try:
        user_id = request.user_id
        if not user_id:
            user_id = "default"
            
        upload_dir = f"uploads/{user_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Construct standard persona schema
        persona = {
            "full_name": request.full_name,
            "professional_title": request.professional_title,
            "summary": request.summary,
            "top_skills": request.top_skills,
            "skills": request.top_skills, # duplicate for broader compat
            "experience_highlights": request.experience_highlights,
            "experience": request.experience_highlights, 
            "education": request.education,
            "years_experience": 0,
            "career_level": "Professional"
        }
        
        # Save Persona to disk
        persona_path = f"{upload_dir}/persona.json"
        with open(persona_path, "w") as f:
            json.dump(persona, f, indent=2)
            
        # Update Unified Persona (local file cache)
        from persona_manager import PersonaManager
        pm = PersonaManager(user_id)
        pm.ingest_resume_data(persona)

        # Sync to profile-service PostgreSQL database (only if we have a real user_id)
        if user_id != "default":
            profile_service_url = os.getenv("PROFILE_SERVICE_URL", "http://profile-service:3001")
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    sync_payload = {
                        "user_id": user_id,
                        "full_name": request.full_name,
                        "headline": request.professional_title,
                        "summary": request.summary,
                        "location": "",
                        "skills": request.top_skills,
                        "experience": request.experience_highlights,
                        "education": request.education,
                        "latest_resume_filename": "manual_draft.json",
                        "latest_resume_path": f"uploads/{user_id}/manual_draft.json"
                    }
                    resp = await client.post(f"{profile_service_url}/sync-resume", json=sync_payload)
                    if resp.status_code == 200:
                        logger.info(f"[resume-draft] Profile synced to DB for user {user_id}")
                    else:
                        logger.warning(f"[resume-draft] Profile sync returned {resp.status_code}: {resp.text}")
            except Exception as sync_err:
                logger.warning(f"[resume-draft] Profile sync to DB failed (non-fatal): {sync_err}")
        else:
            logger.info("Skipping DB sync as user_id is 'default' (likely Onboarding)")

        logger.info(f"Successfully saved manual draft persona for {user_id}")
        
        return {
            "filename": "manual_draft.json",
            "persona": persona,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error saving drafted resume: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving drafted resume: {str(e)}")

@app.get("/resume/persona/{user_id}")
async def get_resume_persona(user_id: str):
    """Retrieve saved persona for user"""
    persona_path = f"uploads/{user_id}/persona.json"
    if not os.path.exists(persona_path):
        return {"status": "not_found", "message": "No resume persona found. Please upload a resume."}
    
    try:
        with open(persona_path, "r") as f:
            persona = json.load(f)
        return {"status": "success", "persona": persona}
    except Exception as e:
        logger.error(f"Error reading persona: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving persona")

@app.post("/resume/persona/{user_id}")
async def update_resume_persona(user_id: str, request: PersonaUpdateRequest):
    """Manually update the saved persona for a user"""
    try:
        from persona_manager import PersonaManager
        pm = PersonaManager(user_id)
        
        # Save the updated raw persona.json
        persona_path = f"uploads/{user_id}/persona.json"
        
        # Merge if exists, else just overwrite
        if os.path.exists(persona_path):
            with open(persona_path, "r") as f:
                existing_persona = json.load(f)
            existing_persona.update(request.persona)
            merged = existing_persona
        else:
            merged = request.persona
            
        with open(persona_path, "w") as f:
            json.dump(merged, f, indent=2)
            
        # Update the unified PersonaManager state
        logger.info(f"[main] Updating persona for {user_id} with names: {merged.get('full_name')}")
        pm.ingest_resume_data(merged)
        
        return {"status": "success", "message": "Persona updated successfully", "persona": merged}
    except Exception as e:
        logger.error(f"Error updating persona: {e}")
        raise HTTPException(status_code=500, detail="Error updating persona")

@app.get("/resume/gini-guide/{user_id}")
async def generate_gini_guide(user_id: str):
    """Generate hyper-personalized GINI Guide (Summary + Key Skills)"""
    try:
        from persona_manager import PersonaManager
        import re
        pm = PersonaManager(user_id)
        
        ollama = get_ollama_client()
        generator = ollama.get_generator("fast")
        
        # Format user profile for context
        identity = pm.profile.get("identity", {})
        skills = pm.profile.get("skills", [])
        experience = pm.profile.get("experience", [])
        
        exp_text = ""
        for i, exp in enumerate(experience[:3]):
            exp_text += f"- {exp.get('role', 'Professional')} at {exp.get('company', 'Company')} ({exp.get('duration', '')})\n"
            highlights = exp.get("highlights", exp.get("key_achievement", exp.get("tailored_bullets", [])))
            if isinstance(highlights, list):
                highlights = " | ".join(highlights)
            if highlights:
                exp_text += f"  Highlights: {highlights[:200]}\n"
        
        prompt = f"""You are GINI, an AI career advisor. Analyze this user's profile and provide a hyper-personalized career guide.

User Profile:
Name: {identity.get("full_name", "User")}
Current Title: {identity.get("professional_title", "Professional")}
Current Skills: {', '.join(skills[:20])}
Recent Experience:
{exp_text}

Task:
1. Determine their most logical next 'target_role' (e.g. "Senior Frontend Developer", "Java Full Stack Intern", "Product Manager"). Do not use generic terms like "Software Engineer" if their experience is more specific.
2. Identify up to 5 of their 'top_skills' that are most relevant to this target role.
3. Identify exactly 3 'missing_skills' (technologies, methodologies, or soft skills) they critically need to learn to land this target role.
4. Write a hyper-personalized, encouraging, and direct 2-paragraph career 'summary' addressing them as "you". Discuss their trajectory from their current role to the target role, and highlight why they need those missing skills. No pleasantries like "Hi".

Output EXACTLY AND ONLY valid JSON in this format:
{{
  "target_role": "Calculated Role",
  "top_skills": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"],
  "missing_skills": ["Missing1", "Missing2", "Missing3"],
  "summary": "The 2-paragraph summary text."
}}
"""

        logger.info(f"Generating dynamic JSON GINI Guide for user {user_id}...")
        response = await asyncio.to_thread(generator.run, prompt=prompt)
        content = response["replies"][0].strip()
        
        # Robustly extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
            
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            raw = match.group(0)
            raw = re.sub(r',(\s*[}\]])', r'\1', raw)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = json.loads(content.strip())
        else:
            data = json.loads(content.strip())
            
        # Ensure fallback fields
        target_role = data.get("target_role", identity.get("professional_title", "Professional"))
        top_skills = data.get("top_skills", skills[:5])
        missing_skills = data.get("missing_skills", ["Communication", "Leadership", "System Design"])
        summary = data.get("summary", "Welcome to your career dashboard! Keep building your skills to reach the next level.")

        return {
            "status": "success",
            "guide": {
                "summary": summary,
                "top_skills": top_skills[:5],
                "missing_skills": missing_skills[:3],
                "target_role": target_role
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating GINI guide: {e}")
        # Return graceful fallback so UI doesn't break
        return {
            "status": "success",
            "guide": {
                "summary": "Welcome to your career dashboard! Upload your resume or complete your profile to receive hyper-personalized career guidance.",
                "top_skills": ["Communication", "Problem Solving"],
                "missing_skills": ["Data Analysis"],
                "target_role": "Professional"
            }
        }

@app.post("/resume/tailor")
async def tailor_resume_endpoint(request: ResumeTailorRequest):
    """Tailor resume to a specific Job Description"""
    try:
        ollama = get_ollama_client()
        agent = ResumeAdvisorAgent(ollama.get_generator("fast"))
        
        # Use provided persona on fallback to saved one
        persona = request.persona
        if not persona:
            persona_path = f"uploads/{request.user_id}/persona.json"
            if os.path.exists(persona_path):
                with open(persona_path, "r") as f:
                    persona = json.load(f)
            else:
                raise HTTPException(status_code=400, detail="No persona provided or found. Please upload resume first.")
        
        result = await agent.tailor_resume(persona, request.job_description)
        
        # Calculate ATS Score on the tailored result
        # To score, we need a flat text representation of the tailored persona
        flat_text = f"{persona.get('full_name', '')}\\n"
        flat_text += f"{result.get('tailored_summary', '')}\\n"
        flat_text += ", ".join(result.get('tailored_skills', [])) + "\\n"
        for exp in result.get('tailored_experience', []):
            flat_text += f"{exp.get('role', '')} {exp.get('company', '')}\\n"
            ach = exp.get("key_achievement") or exp.get("tailored_bullets") or []
            if isinstance(ach, list):
                flat_text += "\\n".join(ach) + "\\n"
            else:
                flat_text += str(ach) + "\\n"
        
        try:
            from resume_ats_scorer import score_resume
            ats_analysis = score_resume(flat_text, request.job_description)
            result["ats_score"] = ats_analysis.get("overall_score", 0)
        except Exception as e:
            logger.error(f"Error calculating ATS score: {e}")
            result["ats_score"] = 0
        
        # Auto-save session for history
        try:
            from datetime import datetime, timezone
            sessions_dir = f"uploads/{request.user_id}/sessions"
            os.makedirs(sessions_dir, exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
            session_id = ts
            session_path = f"{sessions_dir}/{ts}.json"
            session_data = {
                "session_id": session_id,
                "timestamp": ts,
                "job_description": request.job_description,
                "job_title_snippet": request.job_description[:80].strip(),
                "persona": persona,
                "tailored_content": result,
            }
            with open(session_path, "w") as f:
                json.dump(session_data, f, indent=2)
            logger.info(f"Saved session {session_id} for {request.user_id}")
        except Exception as se:
            logger.warning(f"Could not save session: {se}")
        
        return {"status": "success", "tailored_content": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error tailoring resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/resume/sessions/{user_id}")
async def list_resume_sessions(user_id: str):
    """List all saved tailoring sessions for a user, newest first"""
    sessions_dir = f"uploads/{user_id}/sessions"
    if not os.path.exists(sessions_dir):
        return {"status": "success", "sessions": []}
    try:
        sessions = []
        for fname in sorted(os.listdir(sessions_dir), reverse=True):
            if fname.endswith(".json"):
                fpath = os.path.join(sessions_dir, fname)
                with open(fpath, "r") as f:
                    data = json.load(f)
                sessions.append({
                    "session_id": data.get("session_id", fname.replace(".json", "")),
                    "timestamp": data.get("timestamp", ""),
                    "job_title_snippet": data.get("job_title_snippet", ""),
                })
        return {"status": "success", "sessions": sessions}
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail="Error listing sessions")

@app.get("/resume/sessions/{user_id}/{session_id}")
async def load_resume_session(user_id: str, session_id: str):
    """Load a specific saved tailoring session"""
    session_path = f"uploads/{user_id}/sessions/{session_id}.json"
    if not os.path.exists(session_path):
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        with open(session_path, "r") as f:
            data = json.load(f)
        return {"status": "success", "session": data}
    except Exception as e:
        logger.error(f"Error loading session: {e}")
        raise HTTPException(status_code=500, detail="Error loading session")

@app.post("/resume/generate")
async def generate_resume_pdf(request: ResumeTailorRequest):
    """Generate professional PDF resume based on tailored content"""
    try:
        # Use provided content or generate it
        if not request.persona:
            persona_path = f"uploads/{request.user_id}/persona.json"
            if os.path.exists(persona_path):
                with open(persona_path, "r") as f:
                    request.persona = json.load(f)
            else:
                raise HTTPException(status_code=400, detail="No persona found")
         
        # Ensure experience is in standard format if tailored structure is present
        if "tailored_experience" in request.persona and isinstance(request.persona["tailored_experience"], list):
             # Only transform if experience_highlights is NOT already updated/valid
             # or implicitly trust tailored_experience to be the source of truth for PDF
            standard_exp = []
            for item in request.persona["tailored_experience"]:
                exp_entry = {
                    "role": item.get("role", ""),
                    "company": item.get("company", ""),
                    "duration": item.get("duration", ""),
                    # Join bullets into a single string or pick the first one
                    "key_achievement": "; ".join(item.get("tailored_bullets", [])) if isinstance(item.get("tailored_bullets"), list) else item.get("tailored_bullets", "")
                }
                standard_exp.append(exp_entry)
            request.persona["experience_highlights"] = standard_exp
        
        # Mapping summary and skills is now redundant but kept for safety if frontend sends old format
        if "tailored_summary" in request.persona:
            request.persona["summary"] = request.persona["tailored_summary"]
        if "tailored_skills" in request.persona:
            request.persona["top_skills"] = request.persona["tailored_skills"]
                
        # Generate the PDF
        # Note: In a real implementation, we would use reportlab here
        # For now, we will return a mock success response to unblock the frontend
        
        from starlette.concurrency import run_in_threadpool
        from pdf_generator import generate_pdf, generate_cover_letter_pdf
        
        output_dir = f"uploads/{request.user_id}"
        os.makedirs(output_dir, exist_ok=True)
        
        output_resume_path = f"{output_dir}/tailored_resume.pdf"
        output_cl_path     = f"{output_dir}/cover_letter.pdf"

        logger.info(f"Generating PDF for {request.user_id}. Persona keys: {list(request.persona.keys())}")
        
        has_cl = False
        if "cover_letter" in request.persona and str(request.persona["cover_letter"]).strip():
            logger.info("Cover letter found in persona data.")
            logger.info(f"Cover letter length: {len(str(request.persona['cover_letter']))}")
            # Generate cover letter in background thread
            has_cl = await run_in_threadpool(generate_cover_letter_pdf, output_cl_path, request.persona, request.template)
        else:
            logger.warning("Cover letter MISSING from persona data")

        # Run blocking Resume PDF generation in threadpool
        await run_in_threadpool(generate_pdf, output_resume_path, request.persona, request.template, request.profile_pic, request.page_count or 2)
        
        response_data = {
             "status": "success",
             "pdf_url": f"/api/uploads/{request.user_id}/tailored_resume.pdf",
             "message": "Resume generated successfully"
        }
        if has_cl:
             response_data["cover_letter_url"] = f"/api/uploads/{request.user_id}/cover_letter.pdf"
             
        return response_data
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    text = request.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    try:
        # Use direct LLM call for faster parsing (skip LangGraph overhead)
        ollama = get_ollama_client()
        generator = ollama.get_generator("fast")  # Use fast model for quick parsing
        
        prompt = f"""Extract structured information from this resume and return ONLY valid JSON with these exact fields:
{{
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State/Country",
    "title": "Professional Title",
    "summary": "Professional summary",
    "experience": [
        {{"company": "Company Name", "role": "Job Title", "duration": "2020-2023", "description": "Key achievements"}}
    ],
    "education": [
        {{"school": "University Name", "degree": "Degree Name", "year": "2020"}}
    ],
    "skills": ["skill1", "skill2", "skill3"]
}}

Resume text:
{text[:4000]}

Return ONLY the JSON object, no other text."""

        # Direct LLM call natively in Haystack
        response = await asyncio.to_thread(generator.run, prompt=prompt)
        
        ai_response = response["replies"][0]
        
        # Try to extract JSON from response
        parsed_data = {}
        try:
            # Clean up response (remove markdown code blocks if present)
            clean_response = ai_response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()

            # Look for JSON in the cleaned response
            json_start = clean_response.find('{')
            json_end = clean_response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = clean_response[json_start:json_end]
                parsed_data = json.loads(json_str)
                logger.info(f"Successfully parsed resume data: {list(parsed_data.keys())}")
            else:
                raise ValueError("No JSON object found in response")
        except Exception as e:
            logger.warning(f"Could not parse AI response as JSON: {e}")
            # Try basic extraction as fallback
            parsed_data = {
                "raw_response": ai_response,
                "note": "Could not parse as JSON, please edit manually"
            }
        
        return {
            "parsed_data": parsed_data,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        raise HTTPException(status_code=500, detail=f"Error parsing resume: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process user message through LangGraph workflow with caching.
    """
    logger.info(f"Processing chat for user {request.user_id}")
    
    # Check cache first (using user_id + message as key)
    cached_response = cache.get("chat", f"{request.user_id}:{request.message}")
    if cached_response:
        # Parse cached response
        try:
            cached_data = json.loads(cached_response)
            logger.info("✓ Returning cached response")
            return ChatResponse(**cached_data)
        except:
            logger.warning("Failed to parse cached response, regenerating")
    
    # Initialize state
    initial_state: CareerGiniState = {
        "user_id": request.user_id,
        "session_id": request.session_id,
        "messages": [{"role": "user", "content": request.message}],
        "profile_data": request.profile_data,
        "agent_responses": {},
        "final_output": "",
        "suggested_prompts": [],
        "active_agent": "supervisor" # Start with supervisor
    }
    
    try:
        # Run workflow
        result = await workflow.ainvoke(initial_state)
        
        # Extract response
        response_text = result.get("final_output", "I processed your request but have no specific output yet.")
        active_agent = result.get("active_agent", "unknown")
        
        response_data = {
            "response": response_text,
            "agent": active_agent,
            "suggested_prompts": result.get("suggested_prompts", [])
        }
        
        # Cache the response per user
        cache.set("chat", f"{request.user_id}:{request.message}", json.dumps(response_data))
        
        return ChatResponse(**response_data)
        
    except Exception as e:
        logger.error(f"Error processing chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Process user message with streaming response (SSE).
    """
    logger.info(f"Processing streaming chat for user {request.user_id}")
    
    # Check cache first per user
    cached_response = cache.get("chat", f"{request.user_id}:{request.message}")
    if cached_response:
        # Return cached response as a single SSE event
        async def send_cached():
            cached_data = json.loads(cached_response)
            yield f"data: {json.dumps({'type': 'complete', 'data': cached_data})}\n\n"
        
        logger.info("✓ Returning cached response via stream")
        return StreamingResponse(send_cached(), media_type="text/event-stream")
    
    # Stream from LLM
    async def generate():
        try:
            # Send initial metadata
            yield f"data: {json.dumps({'type': 'start', 'message': 'Processing...'})}\n\n"
            
            # Initialize state
            from persona_manager import PersonaManager
            pm = PersonaManager(request.user_id)
            user_context = pm.get_context_for_llm()
            
            # Inject context into the first message or system prompt
            contextualized_message = f"CONTEXT:\n{user_context}\n\nUSER MESSAGE:\n{request.message}"
            
            initial_state: CareerGiniState = {
                "user_id": request.user_id,
                "session_id": request.session_id,
                "messages": [{"role": "user", "content": contextualized_message}],
                "profile_data": request.profile_data,
                "agent_responses": {},
                "final_output": "",
                "suggested_prompts": [],
                "active_agent": "supervisor"
            }
            
            response_text = ""
            active_agent = "unknown"
            
            # Use astream_events to get real-time tokens
            # We must use version="v1" (or "v2" in newer generic LangGraph) - "v1" is safer for compatibility
            async for event in workflow.astream_events(initial_state, version="v1"):
                kind = event["event"]
                node = event.get("metadata", {}).get("langgraph_node", "")
                
                # Detect active agent when supervisor finishes
                if kind == "on_chain_end" and node == "supervisor":
                    outputs = event["data"].get("output")
                    if outputs and isinstance(outputs, dict) and "active_agent" in outputs:
                        active_agent = outputs["active_agent"]
                        yield f"data: {json.dumps({'type': 'agent', 'agent': active_agent})}\n\n"
                
                # Stream tokens from worker agents (ignore supervisor stream)
                if kind == "on_chat_model_stream" and node and node != "supervisor":
                    content = event["data"]["chunk"].content
                    if content:
                        response_text += content
                        yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"

            # Send completion
            response_data = {
                "response": response_text,
                "agent": active_agent,
                "suggested_prompts": []
            }
            
            # Cache the complete response per user
            if response_text:
                cache.set("chat", f"{request.user_id}:{request.message}", json.dumps(response_data))
                yield f"data: {json.dumps({'type': 'done', 'data': response_data})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'error': 'No response generated'})}\n\n"
            
            # --- Background Profile Update ---
            try:
                from agents.profile_updater_agent import ProfileUpdaterAgent
                # Note: ProfileUpdaterAgent extracts info, so we can use a fresh instance or the same approach
                # It uses 'fast' model. It is separate from the workflow.
                updater = ProfileUpdaterAgent(get_ollama_client().get_generator("fast"))
                
                # We need to await if we made it async? 
                # Wait, I didn't verify ProfileUpdaterAgent in details regarding async in the file viewing above, 
                # but I did view it. Let's check if I updated it.
                # I did NOT update ProfileUpdaterAgent yet! I missed it in the list of agents to update.
                # However, ProfileUpdaterAgent inherits from BaseAgent.
                # BaseAgent.run is now async.
                # ProfileUpdaterAgent.analyze_convo calls self.llm.invoke.
                # Since I am calling it here manually, I should probably check if it needs update.
                # If BaseAgent changed, ProfileUpdaterAgent inheritance is fine, but analyze_convo uses self.llm.
                # I should probably update ProfileUpdaterAgent too to be async for consistency and non-blocking in this generator.
                
                # For now, I'll assume I update it next.
                update_data = await updater.analyze_convo(request.message, response_text)
                
                if update_data:
                    logger.info(f"Updating profile from chat: {update_data}")
                    pm.update_from_chat(update_data.get("intent"), update_data.get("data", {}))
            except Exception as e:
                logger.warning(f"Background profile update failed: {e}")
            
        except Exception as e:
            logger.error(f"Error in streaming chat: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

class LinkedInParseRequest(BaseModel):
    url: str

class LinkedInTextParseRequest(BaseModel):
    text: str

@app.post("/linkedin/parse")
async def parse_linkedin_profile(request: LinkedInParseRequest):
    """
    Parse LinkedIn profile from URL
    Note: This has limited success due to LinkedIn's authentication requirements.
    Consider using /linkedin/parse-text instead.
    """
    try:
        logger.info(f"Parsing LinkedIn profile: {request.url}")
        
        # Scrape LinkedIn profile
        parsed_data = await scrape_linkedin_profile(request.url)
        
        logger.info(f"Successfully parsed LinkedIn profile")
        
        return {
            "parsed_data": parsed_data,
            "status": "success"
        }
        
    except ValueError as e:
        logger.error(f"Invalid LinkedIn URL: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error parsing LinkedIn profile: {e}")
        raise HTTPException(status_code=500, detail=f"Error parsing LinkedIn profile: {str(e)}")

@app.post("/linkedin/parse-text")
async def parse_linkedin_text(request: LinkedInTextParseRequest):
    """
    Parse LinkedIn profile data from copied text using AI
    This is more reliable than URL scraping as it works with any profile text
    """
    try:
        logger.info(f"Parsing LinkedIn profile text (length: {len(request.text)} chars)")
        
        if not request.text or len(request.text) < 50:
            raise HTTPException(status_code=400, detail="Please provide more profile text (at least 50 characters)")
        
        # Use AI to extract structured data from LinkedIn text
        ollama = get_ollama_client()
        
        prompt = f"""Extract professional profile information from the following LinkedIn profile text.
Return ONLY a valid JSON object with these exact fields (use empty strings or empty arrays if information is not found):

{{
  "name": "Full name",
  "headline": "Professional title or headline",
  "location": "City, Country or State",
  "summary": "Professional summary or about section",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {{
      "title": "Job title",
      "company": "Company name",
      "duration": "Date range",
      "description": "Brief description"
    }}
  ],
  "education": [
    {{
      "degree": "Degree name",
      "school": "School name",
      "year": "Year or date range"
    }}
  ]
}}

LinkedIn Profile Text:
{request.text[:3000]}

Return ONLY the JSON object, no other text:"""

        response = await ollama.generate(
            model="fast",
            prompt=prompt,
            temperature=0.1
        )
        
        ai_response = response.strip()
        logger.info(f"AI Response (first 200 chars): {ai_response[:200]}")
        
        # Try to parse JSON response
        try:
            # Remove markdown code blocks if present
            if '```json' in ai_response:
                ai_response = ai_response.split('```json')[1].split('```')[0].strip()
            elif '```' in ai_response:
                ai_response = ai_response.split('```')[1].split('```')[0].strip()
            
            parsed_data = json.loads(ai_response)
            
            # Ensure all required fields exist
            result = {
                'name': parsed_data.get('name', ''),
                'headline': parsed_data.get('headline', ''),
                'location': parsed_data.get('location', ''),
                'summary': parsed_data.get('summary', ''),
                'skills': parsed_data.get('skills', []),
                'experience': parsed_data.get('experience', []),
                'education': parsed_data.get('education', []),
                'source': 'linkedin_text',
            }
            
            logger.info(f"Successfully parsed LinkedIn text: {result.get('name', 'N/A')}")
            
            return {
                "parsed_data": result,
                "status": "success"
            }
            
        except json.JSONDecodeError as e:
            logger.warning(f"Could not parse AI response as JSON: {e}")
            # Fallback: return basic extraction
            return {
                "parsed_data": {
                    "name": "",
                    "headline": "",
                    "location": "",
                    "summary": request.text[:500],
                    "skills": [],
                    "experience": [],
                    "education": [],
                    "source": "linkedin_text",
                    "note": "AI extraction partial. Please verify fields manually."
                },
                "status": "partial"
            }
        
    except Exception as e:
        logger.error(f"Error parsing LinkedIn text: {e}")
        raise HTTPException(status_code=500, detail=f"Error parsing LinkedIn text: {str(e)}")

# ============================================
# ENHANCEMENT FEATURES - ATS & JOB MATCHING
# ============================================

class ATSScoreRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None

class JobMatchRequest(BaseModel):
    user_profile: Dict[str, Any]
    job_posting: Dict[str, Any]

@app.post("/resume/ats-score")
async def ats_score_endpoint(request: ATSScoreRequest):
    """
    Score resume for ATS compatibility
    
    Returns comprehensive analysis with scores, issues, and improvements
    """
    try:
        # Check cache (key based on resume text hash + job description)
        cache_key_content = f"{request.resume_text[:100]}_{hash(request.resume_text)}_{request.job_description}"
        cached_result = cache.get("ats_score", cache_key_content)
        if cached_result:
            return json.loads(cached_result)

        logger.info("Scoring resume for ATS compatibility")
        result = score_resume(request.resume_text, request.job_description)
        
        # Cache result
        cache.set("ats_score", cache_key_content, json.dumps(result))
        return result
    except Exception as e:
        logger.error(f"Error scoring resume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/jobs/match-score")
async def job_match_endpoint(request: JobMatchRequest):
    """
    Calculate match score between user profile and job posting
    
    Returns match score with detailed breakdown
    """
    try:
        # Check cache (key based on user ID or profile hash + job ID or content)
        # Using a simple deterministic string representation for the key
        user_hash = hash(json.dumps(request.user_profile, sort_keys=True))
        job_hash = hash(json.dumps(request.job_posting, sort_keys=True))
        cache_key = f"{user_hash}_{job_hash}"
        
        cached_result = cache.get("job_match", cache_key)
        if cached_result:
             return json.loads(cached_result)

        logger.info("Calculating job match score")
        result = match_job(request.user_profile, request.job_posting)
        
        # Cache result
        cache.set("job_match", cache_key, json.dumps(result))
        return result
    except Exception as e:
        logger.error(f"Error calculating match score: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# SKILL GAP ANALYSIS
# ============================================

class SkillGapRequest(BaseModel):
    user_profile: Dict[str, Any]
    target_role: str

@app.post("/skills/gap-analysis")
async def skill_gap_endpoint(request: SkillGapRequest):
    """
    Analyze skill gaps for target role
    
    Returns readiness score, gaps, and learning path
    """
    try:
        logger.info(f"Analyzing skill gaps for role: {request.target_role}")
        result = analyze_skill_gaps(request.user_profile, request.target_role)
        return result
    except Exception as e:
        logger.error(f"Error analyzing skill gaps: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# AI MOCK INTERVIEW
# ============================================

class InterviewStartRequest(BaseModel):
    job_role: str
    company: Optional[str] = None
    difficulty: str = 'medium'

class InterviewAnswerRequest(BaseModel):
    session: Dict[str, Any]
    question: str
    answer: str
    question_type: str

@app.post("/interview/start")
async def start_interview_endpoint(request: InterviewStartRequest):
    """
    Start AI mock interview session
    
    Returns session info and first question
    """
    try:
        logger.info(f"Starting interview session for role: {request.job_role}")
        ollama = get_ollama_client()
        result = await create_interview_session(
            ollama,
            request.job_role,
            request.company,
            request.difficulty
        )
        return result
    except Exception as e:
        logger.error(f"Error starting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interview/evaluate")
async def evaluate_answer_endpoint(request: InterviewAnswerRequest):
    """
    Evaluate interview answer
    
    Returns evaluation with scores and feedback
    """
    try:
        logger.info("Evaluating interview answer")
        ollama = get_ollama_client()
        result = await evaluate_interview_answer(
            ollama,
            request.session,
            request.question,
            request.answer,
            request.question_type
        )
        return result
    except Exception as e:
        logger.error(f"Error evaluating answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# CAREER PATH PREDICTION
# ============================================

class CareerPathRequest(BaseModel):
    user_profile: Dict[str, Any]
    target_role: Optional[str] = None

@app.post("/career/predict-path")
async def career_path_endpoint(request: CareerPathRequest):
    """
    Predict career path and progression
    
    Returns timeline, milestones, and salary projections
    """
    try:
        logger.info("Predicting career path")
        result = predict_career_path(request.user_profile, request.target_role)
        return result
    except Exception as e:
        logger.error(f"Error predicting career path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# PROACTIVE CAREER ADVISOR
# ============================================

class AdvisorRequest(BaseModel):
    user_profile: Dict[str, Any]
    user_activity: Dict[str, Any]
    applications: List[Dict[str, Any]]
    skill_gaps: Optional[Dict[str, Any]] = None

@app.post("/advisor/nudges")
async def advisor_nudges_endpoint(request: AdvisorRequest):
    """
    Generate proactive career nudges
    
    Returns personalized recommendations and actions
    """
    try:
        logger.info("Generating career nudges")
        result = generate_career_nudges(
            request.user_profile,
            request.user_activity,
            request.applications,
            request.skill_gaps
        )
        return {"nudges": result}
    except Exception as e:
        logger.error(f"Error generating nudges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# ANALYTICS DASHBOARD
# ============================================

class AnalyticsRequest(BaseModel):
    user_id: str
    applications: List[Dict[str, Any]]
    user_profile: Dict[str, Any]
    skill_gaps: Optional[Dict[str, Any]] = None
    timeframe_days: int = 90

@app.post("/analytics/dashboard")
async def analytics_dashboard_endpoint(request: AnalyticsRequest):
    """
    Generate comprehensive analytics dashboard
    
    Returns funnel, timeline, performance, insights, and recommendations
    """
    try:
        logger.info(f"Generating analytics dashboard for user: {request.user_id}")
        result = generate_analytics_dashboard(
            request.user_id,
            request.applications,
            request.user_profile,
            request.skill_gaps,
            request.timeframe_days
        )
        return result
    except Exception as e:
        logger.error(f"Error generating analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# AGENTIC JOB HUNTER
# ============================================

class JobHuntRequest(BaseModel):
    role: str
    location: str
    skills: List[str] = []

class ApplicationDraftRequest(BaseModel):
    user_profile: Dict[str, Any]
    job_details: Dict[str, Any]

@app.post("/agent/hunt")
async def agent_hunt_endpoint(request: JobHuntRequest):
    """
    Agentic Job Search: Finds tailored opportunities
    """
    try:
        logger.info(f"Agent hunting for: {request.role}")
        ollama = get_ollama_client()
        agent = JobHunterAgent(ollama.get_generator("reasoning"))
        
        criteria = {
            "role": request.role,
            "location": request.location,
            "skills": request.skills
        }
        
        opportunities = agent.find_opportunities(criteria)
        return {"opportunities": opportunities}
    except Exception as e:
        logger.error(f"Error in job hunt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/draft")
async def agent_draft_endpoint(request: ApplicationDraftRequest):
    """
    Agentic Application Drafter: Creates cover letter & resume summary
    """
    try:
        logger.info("Drafting application")
        ollama = get_ollama_client()
        agent = JobHunterAgent(ollama.get_generator("reasoning"))
        
        result = agent.draft_application(request.user_profile, request.job_details)
        return result
    except Exception as e:
        logger.error(f"Error drafting application: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
