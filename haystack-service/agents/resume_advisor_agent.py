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
        "role":    exp.get("role") or exp.get("title", ""),
        "company": exp.get("company", ""),
        "period":  exp.get("duration") or exp.get("period") or exp.get("dates", ""),
        "highlights": ach,
    }


def _compute_gap_analysis(persona: Dict[str, Any], job_description: str) -> List[str]:
    """Python-level deterministic gap analysis — compares JD keywords to candidate profile."""
    suggestions = []
    jd_lower = job_description.lower()
    
    # Collect all candidate text for comparison
    skills = [s.lower() for s in (persona.get("top_skills") or [])]
    summary = (persona.get("summary") or "").lower()
    exp_text = " ".join([
        f"{e.get('role','')} {e.get('company','')} {' '.join(e.get('tailored_bullets') or e.get('key_achievement') or []) if isinstance((e.get('tailored_bullets') or e.get('key_achievement')), list) else str(e.get('tailored_bullets') or e.get('key_achievement',''))}"
        for e in (persona.get("experience_highlights") or [])
    ]).lower()
    projects = " ".join([
        f"{p.get('name','')} {p.get('description','')}" for p in (persona.get("projects") or [])
    ]).lower()
    all_candidate_text = " ".join([summary, exp_text, projects] + skills)
    
    # Key technology stacks to check for
    tech_groups = {
        "react": ["react", "reactjs", "react.js"],
        "node.js": ["node", "nodejs", "express"],
        "typescript": ["typescript", "ts"],
        "kubernetes": ["kubernetes", "k8s"],
        "docker": ["docker", "containeris"],
        "aws": ["aws", "amazon web services", "ec2", "s3", "lambda"],
        "sql": ["sql", "postgres", "mysql", "database"],
        "machine learning": ["machine learning", "ml", "tensorflow", "pytorch"],
        "graphql": ["graphql"],
        "redis": ["redis", "caching"],
        "leadership": ["team lead", "management", "managed a team", "led a team"],
        "agile": ["agile", "scrum", "kanban", "sprint"],
    }
    
    missing = []
    for tech, variants in tech_groups.items():
        jd_mentions = any(v in jd_lower for v in variants)
        candidate_has = any(v in all_candidate_text for v in variants)
        if jd_mentions and not candidate_has:
            missing.append(tech)
    
    # Generate readable suggestions
    for tech in missing[:3]:
        if tech in ["leadership", "agile"]:
            suggestions.append(f"Add details about team leadership or {tech} experience to strengthen JD alignment.")
        else:
            suggestions.append(f"The JD requires '{tech}' — add a project or skill entry showcasing your {tech} experience to improve the ATS match.")
    
    # Check for missing quantifiable achievements
    has_numbers = bool(re.search(r'\d+[%x]?|\$\d+|\d+\s*(million|k|users|team|members)', all_candidate_text))
    if not has_numbers:
        suggestions.append("Add quantifiable achievements (e.g., 'Reduced latency by 30%', 'Led a team of 5') to strengthen impact.")
    
    # Check for missing LinkedIn URL
    if not persona.get("linkedin"):
        suggestions.append("Add your LinkedIn profile URL — many ATS systems use it to validate your professional presence.")
    
    return suggestions[:4]  # Cap at 4 suggestions


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
        # TOKEN BUDGET (qwen2.5:1.5b, num_ctx=4096):
        #   ~600 tokens: instructions + rules
        #   ~400 tokens: candidate JSON (name, title, summary, skills, 3 exp)
        #   ~150 tokens: JD excerpt
        #   ~150 tokens: JSON output schema
        #   ~800 tokens: reserved for LLM response
        #   Total budget: ~2100 input + 800 output = ~2900 tokens (safe in 4096)
        experiences = [
            _fmt_exp(e)
            for e in (persona.get("experience_highlights") or [])[:5]  # top 5 roles only
        ]
        candidate = {
            "name":      persona.get("full_name", ""),
            "title":     persona.get("professional_title", ""),
            "summary":   str(persona.get("summary", ""))[:400],   # 100 tokens max
            "skills":    (persona.get("top_skills") or [])[:15],  # top 15 skills
            "exp":       experiences,
            "projects":  [
                {"name": p.get("name",""), "desc": str(p.get("description",""))[:120]}
                for p in (persona.get("projects") or [])[:3]       # top 3 projects
            ],
            "edu":       (persona.get("education") or [])[:2],    # top 2 degrees
            "certs":     (persona.get("certifications") or [])[:4],
        }
        # 600 chars (~150 tokens) of JD — enough to get key requirements
        slim_jd = str(job_description)[:600]

        focus_note = f"Emphasize {focus_area}." if focus_area else ""
        industry_note = f"Use {target_industry} industry vocabulary." if target_industry else ""

        # Compact template rules — keep token count low
        if template == "executive":
            style = "Executive tone: authoritative, no first-person. Reframe skills as leadership domains. Lead bullets with scope+outcome."
        elif template == "fresher":
            style = "Fresher tone: write Career Objective (3 sentences). Emphasise projects, internships, academic wins. Keep bullets to 2-3."
        else:
            style = "Professional tone: STAR bullets (action→task→metric). 3-4 bullets per role. ATS keywords from JD in skills list."

        prompt = f"""You are a professional resume writer. Tailor this resume for the job. Output ONLY valid JSON.
Rules: Do NOT invent roles/companies/dates. Only improve existing content. {style} {focus_note} {industry_note}

Candidate:
{json.dumps(candidate)}

Job (key requirements):
{slim_jd}

JSON output (copy all exp entries, improve bullets and summary):
{{"tailored_summary":"3-4 sentence summary tailored to this job","tailored_skills":["skill1","skill2"],"tailored_experience":[{{"role":"role","company":"company","duration":"dates","tailored_bullets":["STAR bullet 1","STAR bullet 2","STAR bullet 3"]}}],"tailored_projects":[{{"name":"name","description":"desc"}}],"education":[{{"degree":"deg","school":"school","year":"yr"}}],"certifications":["cert"]}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result   = _parse_json(content)
            # Always compute gap_analysis at Python level (LLM may skip it)
            result["gap_analysis"] = _compute_gap_analysis(persona, job_description)
            return {"tailored_result": result}
        except Exception as e:
            logger.error(f"Tailoring failed: {e}")
            return {"tailored_result": {
                "tailored_summary":    persona.get("summary", ""),
                "tailored_skills":     persona.get("top_skills", []),
                "tailored_experience": [_fmt_exp(e) for e in (persona.get("experience_highlights") or [])],
                "tailored_projects":   persona.get("projects", []),
                "education":           persona.get("education", []),
                "match_analysis":      "Tailor step encountered an error; original data preserved.",
                "gap_analysis":        _compute_gap_analysis(persona, job_description)
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

def _finalize_python(persona: Dict[str, Any], template: str, page_count: int) -> Dict[str, Any]:
    """
    Python-native finalization — NO LLM call needed.
    Simply normalises field names and ensures the output dict has all keys
    the PDF generator expects. This eliminates an entire LLM round-trip,
    cutting the finalize step from ~90s → <1ms.
    """
    compact = (page_count == 1)

    summary = (persona.get("tailored_summary")
               or persona.get("summary")
               or "")
    skills = (persona.get("tailored_skills")
              or persona.get("top_skills")
              or [])
    # Max skills: 12 for compact, all for full
    skills = skills[:12] if compact else skills

    exp_src = (persona.get("tailored_experience")
               or persona.get("experience_highlights")
               or [])
    tailored_exp = []
    for e in exp_src[:8]:
        blist = (e.get("tailored_bullets")
                 or e.get("bullets")
                 or e.get("key_achievement")
                 or [])
        if isinstance(blist, str):
            blist = [b.strip() for b in blist.replace(";", "\n").split("\n") if b.strip()]
        # For 1-page: keep 3 bullets per role; for 2-page: keep all
        if compact:
            blist = blist[:3]
        tailored_exp.append({
            "role":              e.get("role") or e.get("title", ""),
            "company":           e.get("company") or e.get("organization", ""),
            "duration":          e.get("duration") or e.get("period") or e.get("dates", ""),
            "tailored_bullets":  blist,
        })

    projects = (persona.get("tailored_projects")
                or persona.get("projects")
                or [])

    return {
        "tailored_summary":    summary,
        "tailored_skills":     skills,
        "tailored_experience": tailored_exp,
        "tailored_projects":   projects,
        "education":           persona.get("education", []),
        "certifications":      persona.get("certifications", []),
        "awards":              persona.get("awards", []),
        "languages":           persona.get("languages", []),
        "cover_letter":        persona.get("cover_letter", ""),
        "gap_analysis":        persona.get("gap_analysis", []),
        "match_analysis":      persona.get("match_analysis", ""),
        "full_name":           persona.get("full_name", ""),
        "professional_title":  persona.get("professional_title", ""),
        "email":               persona.get("email", ""),
        "phone":               persona.get("phone", ""),
        "location":            persona.get("location", ""),
        "linkedin":            persona.get("linkedin", ""),
        "portfolio_url":       persona.get("portfolio_url", ""),
    }


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
        Extract structured persona from resume text.
        TOKEN BUDGET for qwen2.5:1.5b (num_ctx=4096):
          ~500 tokens: resume text (2000 chars)
          ~250 tokens: prompt instructions
          ~150 tokens: JSON schema definition
          ~800 tokens: LLM response (the structured JSON)
          Total: ~1700 tokens — well within 4096 window.
        """
        # 2000 chars (~500 tokens) — covers the most important sections of any resume
        resume_snippet = str(resume_text).strip()[:2000]

        prompt = f"""Extract resume info. Output ONLY valid JSON, no explanation.

Resume:
{resume_snippet}

JSON:
{{"full_name":"","professional_title":"","email":"","phone":"","location":"","linkedin":"","years_experience":0,"summary":"2-3 sentence professional bio","top_skills":["skill1"],"experience_highlights":[{{"role":"","company":"","duration":"","tailored_bullets":["achievement 1","achievement 2"]}}],"projects":[{{"name":"","description":""}}],"education":[{{"degree":"","school":"","year":""}}],"certifications":[],"career_level":"Mid"}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result = _parse_json(content)
            # Ensure contact fields exist to prevent UI errors
            result.setdefault("email", "")
            result.setdefault("phone", "")
            result.setdefault("linkedin", "")
            result.setdefault("portfolio_url", "")
            return result
        except Exception as e:
            logger.error(f"Persona extraction failed: {e}")
            return {
                "full_name":             "Candidate",
                "professional_title":    "Professional",
                "years_experience":      0,
                "email":                 "",
                "phone":                 "",
                "location":              "",
                "linkedin":              "",
                "portfolio_url":         "",
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
        if "gap_analysis" in tailor_result["tailored_result"]:
            final["gap_analysis"] = tailor_result["tailored_result"]["gap_analysis"]
        return final

    async def finalize_resume(self, persona: Dict[str, Any], template: str, page_count: int, job_description: str = "") -> Dict[str, Any]:
        """Stage 2: Finalize content for specific template and page count.
        Uses Python-native finalization — no LLM call, instant execution.
        """
        logger.info(f"Finalizing resume (Python-native) [{template}, {page_count}p]")
        return _finalize_python(persona, template, page_count)

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Standard run method for workflow integration."""
        resume_text = state.get("resume_text", "")
        if resume_text:
            persona = self.extract_persona(resume_text)
            return {**state, "persona": persona}
        return state
