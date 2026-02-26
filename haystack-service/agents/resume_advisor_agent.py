from .base_agent import BaseAgent
from typing import Dict, Any, List, Optional
import json
import logging
import re
import asyncio
from haystack import component
from haystack.core.pipeline import AsyncPipeline

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_json(content: str) -> dict:
    """Robustly extract the first JSON object from LLM output."""
    # Strip markdown fences
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    # Find the first { ... } block
    match = re.search(r'\{.*\}', content, re.DOTALL)
    if match:
        raw = match.group(0)
        # Repair trailing commas before } or ]
        raw = re.sub(r',(\s*[}\]])', r'\1', raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return json.loads(content.strip())


def _fmt_exp(exp: dict) -> dict:
    """Normalise an experience entry for prompt serialisation."""
    ach = exp.get("key_achievement") or exp.get("tailored_bullets") or ""
    if isinstance(ach, list):
        ach = " | ".join(ach)
    return {
        "role":     exp.get("role", ""),
        "company":  exp.get("company", ""),
        "duration": exp.get("duration", ""),
        "highlights": str(ach)[:300],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Haystack components
# ─────────────────────────────────────────────────────────────────────────────

@component
class TailorResumeComponent:
    """
    Rewrites the candidate's profile sections to align with the target JD.
    Preserves all authentic job history — never invents roles or employers.
    For a 1-page resume the PDF generator will trim bullets; for a 2-page
    resume it shows all of them, so we always generate as many as possible here.
    """
    def __init__(self, generator):
        self.generator = generator

    @component.output_types(tailored_result=Dict[str, Any])
    def run(self, persona: Dict[str, Any], job_description: str, target_industry: str = "", focus_area: str = "", template: str = "professional"):
        # Pass the full authentic experience (up to 6 roles, 300 chars each)
        experiences = [
            _fmt_exp(e)
            for e in (persona.get("experience_highlights") or [])[:6]
        ]
        candidate = {
            "name":       persona.get("full_name", ""),
            "title":      persona.get("professional_title", ""),
            "summary":    str(persona.get("summary", ""))[:400],
            "skills":     (persona.get("top_skills") or [])[:20],
            "experience": experiences,
            "projects":   (persona.get("projects") or [])[:5],
            "education":  (persona.get("education") or [])[:3],
        }
        slim_jd = str(job_description)[:700]

        industry_prompt = f"- Align the vocabulary and metrics to the {target_industry} industry standard." if target_industry else ""
        focus_prompt = f"- Give special emphasis to {focus_area} in the summary and bullets." if focus_area else ""

        # ── Template-specific tailoring instructions ──────────────────────────
        if template == "executive":
            template_rules = """- Write all bullet points as leadership-impact statements: lead with scope (team size, budget, P&L) then outcome.
- Generate a 4-5 sentence executive narrative summary (strategic vision + career arc + value proposition).
- Reframe skills as 9 leadership domains / competency areas (not just tool names). E.g. "P&L Management", "Enterprise Sales", "Cross-Functional Leadership".
- Quantify everything possible: revenue, headcount, growth %, cost savings, cycle time reduction.
- Tone: authoritative, visionary, board-room ready. No first-person pronouns."""
        elif template == "fresher":
            template_rules = """- Write a Career Objective (2-3 sentences) focused on what the candidate WANTS to contribute and learn, not just what they've done.
- Emphasize academic achievements, coursework projects, hackathons, open-source, internships over formal career history.
- Skills must be specific concrete tool/technology names (Python, React, SQL, Figma) learned in coursework or self-study.
- For any internships or part-time work: frame contributions as learning + tangible delivery.
- Tone: ambitious, enthusiastic, growth-focused. Max 2 bullet points per role.
- If the candidate has limited work experience, prioritize projects — make project descriptions detailed and impactful."""
        else:
            template_rules = """- Write all bullet points as concise metric-driven ATS-optimised statements (action verb → task → quantified result).
- Generate a tight 3-sentence professional summary (current title + top 2 skills + value to employer).
- Include exact keyword phrases from the JD in skills list for maximum ATS match.
- Tone: professional and confident. No jargon. Sentences under 20 words each."""

        prompt = f"""You are a professional resume writer. Tailor this candidate's resume for the job below.

STRICT RULES:
- DO NOT invent any job titles, companies, projects, or dates that are not in the candidate data.
- DO NOT add fake achievements. Only rewrite and improve existing ones with stronger action verbs and quantifiable metrics where possible.
- CONSOLIDATE EXPERIENCE: If multiple entries exist for the same Role at the same Company and Date, MERGE them into a single entry with a unified list of bullet points. NEVER output duplicate roles.
- Generate 3-4 impactful bullet points per role based ONLY on the provided highlights.
{template_rules}
{industry_prompt}
{focus_prompt}
- Return the candidate's Education details exactly as provided.
- If the candidate has Projects, include and tailor their descriptions.
- Output ONLY valid JSON. No preamble or explanation.

Candidate:
{json.dumps(candidate)}

Job Description (excerpt):
{slim_jd}

Required JSON:
{{"tailored_summary":"summary text","tailored_skills":["skill1","skill2"],"tailored_experience":[{{"role":"Exact role","company":"Exact company","duration":"Exact dates","tailored_bullets":["Bullet 1","Bullet 2","Bullet 3"]}}],"tailored_projects":[{{"name":"Project Name","description":"Tailored Description"}}],"education":[{{"degree":"Degree","school":"School","year":"Year"}}],"match_analysis":"1-2 sentences on candidate fit"}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result   = _parse_json(content)
            return {"tailored_result": result}
        except Exception as e:
            logger.error(f"Tailoring failed: {e}")
            return {"tailored_result": {
                "tailored_summary":    persona.get("summary", ""),
                "tailored_skills":     persona.get("top_skills", []),
                "tailored_experience": [_fmt_exp(e) for e in (persona.get("experience_highlights") or [])],
                "tailored_projects":   persona.get("projects", []),
                "education":           persona.get("education", []),
                "match_analysis":      "Tailor step encountered an error; original data preserved."
            }}


@component
class CoverLetterComponent:
    """
    Generates a crisp half-page cover letter (~150 words, 2-3 short paragraphs).
    Designed to fit on less than half of page 1 of the final PDF.
    """
    def __init__(self, generator):
        self.generator = generator

    @component.output_types(cover_letter=str)
    def run(self, persona: Dict[str, Any], job_description: str, target_industry: str = "", focus_area: str = ""):
        name  = persona.get("full_name", "Candidate")
        title = persona.get("professional_title", "Professional")
        top3  = (persona.get("top_skills") or [])[:3]
        slim_jd = str(job_description)[:500]

        industry_prompt = f"- Use tone appropriate for the {target_industry} industry." if target_industry else ""
        focus_prompt = f"- Emphasize {focus_area}." if focus_area else ""

        prompt = f"""Write a professional cover letter for {name} ({title}) applying to this role.

Rules:
{industry_prompt}
{focus_prompt}
- MAXIMUM 150 words total. Be crisp and punchy.
- 2 short paragraphs only: (1) intro + value proposition, (2) call to action.
- Mention 2-3 specific skills: {', '.join(top3)}.
- Do NOT exceed 150 words under any circumstance.
- Start directly with "Dear Hiring Manager," — no header, no date, no address.
- End with "Sincerely,\\n{name}".
- If the company name or job details are vague/missing, write a generic but strong opening (e.g., "I am writing to express my interest in the open position...") rather than using placeholders like [Company Name].
- Output ONLY the letter text, nothing else.

Job (excerpt):
{slim_jd}"""

        try:
            response = self.generator.run(prompt=prompt)
            letter   = response["replies"][0].strip()
            # Hard-trim at 1000 chars as a safety net so it never overruns half a page
            if len(letter) > 1000:
                letter = letter[:950] + "...\n\nSincerely,\n" + name
            return {"cover_letter": letter}
        except Exception as e:
            logger.error(f"Cover letter failed: {e}")
            return {"cover_letter": (
                f"Dear Hiring Manager,\n\n"
                f"I am excited to apply for this opportunity. As a {title}, I bring "
                f"expertise in {', '.join(top3)} and a strong track record of delivering results. "
                f"I am confident I would be a valuable addition to your team.\n\n"
                f"Sincerely,\n{name}"
            )}


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Finalize content for specific template + page count
# ─────────────────────────────────────────────────────────────────────────────

@component
class FinalizeResumeComponent:
    """
    Stage 2 AI step: takes Stage 1 tailored persona + user edits, then
    re-polishes the final text for the selected template's tone/density
    and page constraint (1-page compact vs 2-page full-detail).

    NOT a re-tailor — JD alignment is preserved from Stage 1.
    Its job: adapt length, tone, and emphasis for the chosen format.
    """
    def __init__(self, generator):
        self.generator = generator

    @component.output_types(final_result=Dict[str, Any])
    def run(self, persona: Dict[str, Any], template: str, page_count: int, job_description: str = ""):
        compact  = (page_count == 1)
        slim_jd  = str(job_description)[:500]

        tailored_summary = persona.get("summary") or persona.get("tailored_summary", "")
        tailored_skills  = persona.get("top_skills") or persona.get("tailored_skills", [])
        tailored_exp     = []
        for e in (persona.get("experience_highlights") or persona.get("tailored_experience") or [])[:6]:
            blist = e.get("tailored_bullets") or e.get("key_achievement") or []
            if isinstance(blist, str):
                blist = [b.strip() for b in blist.split(";") if b.strip()]
            tailored_exp.append({
                "role": e.get("role", ""), "company": e.get("company", ""),
                "duration": e.get("duration", ""), "bullets": blist,
            })

        if template == "executive":
            tone_rules = """- Tone: authoritative, board-room ready, no first-person pronouns.
- Summary: 4-5 sentence strategic narrative (vision + impact + career arc).
- Competencies: 9 leadership domain phrases (not tool names).
- Bullets: scope (team/budget/revenue) then measurable outcome. Max 4 per role."""
        elif template == "fresher":
            tone_rules = f"""- Rewrite summary as Career Objective: 2 sentences — contribution intent + strongest qualification.
- Skills: concrete tool/tech names only.
- Bullets per role: max {'2' if compact else '3'} — frame as learning + tangible delivery.
- Emphasize projects heavily — make descriptions specific and results-oriented.
- Tone: ambitious, eager, forward-looking."""
        else:
            tone_rules = f"""- Tone: clean, confident, ATS-friendly.
- Summary: exactly 3 sentences — role + top skill + value promise.
- Bullets: action verb → task → metric. Max {'2' if compact else '4'} per role.
- Skills: exact keyword phrases from JD."""

        page_rules = f"""- Format: {'1-PAGE COMPACT (be concise, trim bullets to 2 per role, skills max 8)' if compact else '2-PAGE FULL-DETAIL (include all bullets and skills, be thorough)'}."""

        prompt = f"""You are a professional resume editor finalizing content for a {template.upper()} template on {page_count} page(s).
DO NOT re-invent or hallucinate content. Only adapt tone, length, and emphasis.

Rules:
{tone_rules}
{page_rules}

Tailored content to finalize:
Summary: {tailored_summary[:600]}
Skills: {', '.join(tailored_skills[:20])}
Experience: {json.dumps(tailored_exp)}
JD context: {slim_jd}

Output ONLY valid JSON:
{{"tailored_summary":"final summary","tailored_skills":["skill1","skill2"],"tailored_experience":[{{"role":"role","company":"company","duration":"duration","tailored_bullets":["bullet1","bullet2"]}}]}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result   = _parse_json(content)
            result.setdefault("tailored_projects", persona.get("projects") or persona.get("tailored_projects", []))
            result.setdefault("education", persona.get("education", []))
            result["cover_letter"] = persona.get("cover_letter", "")
            return {"final_result": result}
        except Exception as e:
            logger.error(f"Finalize failed: {e}")
            return {"final_result": {
                "tailored_summary":    tailored_summary,
                "tailored_skills":     tailored_skills,
                "tailored_experience": tailored_exp,
                "tailored_projects":   persona.get("projects") or persona.get("tailored_projects", []),
                "education":           persona.get("education", []),
                "cover_letter":        persona.get("cover_letter", ""),
            }}


# ─────────────────────────────────────────────────────────────────────────────
# Main Agent
# ─────────────────────────────────────────────────────────────────────────────

class ResumeAdvisorAgent(BaseAgent):
    def __init__(self, generator):
        super().__init__(generator)
        self.pipeline = AsyncPipeline()
        self.pipeline.add_component("tailor_resume", TailorResumeComponent(self.generator))
        self.pipeline.add_component("cover_letter",  CoverLetterComponent(self.generator))

    def extract_persona(self, resume_text: str) -> Dict[str, Any]:
        """
        Extract a structured professional persona from resume text.

        We pass up to 4000 chars (covers ~2-page PDF) so no section is lost.
        We then ask the model to extract compactly so the response stays fast.
        """
        # Pass a meaningful slice — 3000 chars is enough for most resumes
        resume_snippet = str(resume_text).strip()[:3000]

        prompt = f"""Extract structured information from this resume. Output ONLY valid JSON.
Resume text:
{resume_snippet}

Required JSON structure (extract real info only):
{{
  "full_name": "Full name",
  "professional_title": "Current role",
  "years_experience": 0,
  "email": "email",
  "phone": "phone",
  "location": "city, country",
  "linkedin": "linkedin URL if present",
  "portfolio_url": "portfolio/github URL if present",
  "summary": "2-3 sentence bio",
  "top_skills": ["Skill 1", "Skill 2"],
  "experience_highlights": [{{"role":"Title","company":"Company","duration":"Dates","key_achievement":"One bullet"}}],
  "projects": [{{"name":"Project Name","description":"Brief description of what was built and tools used"}}],
  "education": [{{"degree":"Degree","school":"School","year":"Year"}}],
  "career_level": "Entry/Mid/Senior/Exec",
  "suggested_roles": ["Role 1", "Role 2"]
}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            return _parse_json(content)
        except Exception as e:
            logger.error(f"Persona extraction failed: {e}")
            return {
                "full_name":             "Candidate",
                "professional_title":    "Professional",
                "years_experience":      0,
                "summary":               "Resume uploaded. Please review and edit the details below.",
                "top_skills":            [],
                "experience_highlights": [],
                "projects":              [],
                "education":             [],
                "certifications":        [],
                "career_level":          "Unknown",
                "suggested_roles":       [],
            }

    async def tailor_resume(self, persona: Dict[str, Any], job_description: str, target_industry: str = "", focus_area: str = "", template: str = "professional") -> Dict[str, Any]:
        """Tailor persona to a JD, running components sequentially."""
        print(f"Resume Advisor Agent tailoring resume [{template}]...")

        tailor_comp = TailorResumeComponent(self.generator)
        cl_comp     = CoverLetterComponent(self.generator)

        loop = asyncio.get_event_loop()

        tailor_result = await loop.run_in_executor(
            None,
            lambda: tailor_comp.run(persona=persona, job_description=job_description, target_industry=target_industry, focus_area=focus_area, template=template)
        )
        cl_result = await loop.run_in_executor(
            None,
            lambda: cl_comp.run(persona=persona, job_description=job_description, target_industry=target_industry, focus_area=focus_area)
        )

        final = tailor_result["tailored_result"]
        final["cover_letter"] = cl_result["cover_letter"]
        return final

    async def finalize_resume(self, persona: Dict[str, Any], template: str, page_count: int, job_description: str = "") -> Dict[str, Any]:
        """Stage 2: Finalize content for specific template and page count."""
        print(f"Resume Advisor Agent finalizing resume [{template}, {page_count}p]...")
        
        finalize_comp = FinalizeResumeComponent(self.generator)
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            None,
            lambda: finalize_comp.run(persona=persona, template=template, page_count=page_count, job_description=job_description)
        )
        return result["final_result"]

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Standard run method for workflow integration."""
        resume_text = state.get("resume_text", "")
        if resume_text:
            persona = self.extract_persona(resume_text)
            return {**state, "persona": persona}
        return state
