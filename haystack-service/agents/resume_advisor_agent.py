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

def _sanitize_bullets_list(bullets):
    if not isinstance(bullets, list):
        bullets = [bullets]
    clean = []
    for b in bullets:
        if isinstance(b, dict):
            parts = [str(b[k]).strip() for k in ["action", "result"] if b.get(k)]
            if parts:
                clean.append(" ".join(parts))
            else:
                clean.append(" - ".join(str(v) for v in b.values() if v))
        elif isinstance(b, str):
            clean.append(b)
        else:
            clean.append(str(b))
    return clean

def _sanitize_dict(data: dict) -> dict:
    if not isinstance(data, dict): return data
    for key in ["tailored_experience", "experience", "experience_highlights"]:
        if key in data and isinstance(data[key], list):
            for exp in data[key]:
                if not isinstance(exp, dict): continue
                if "tailored_bullets" in exp:
                    exp["tailored_bullets"] = _sanitize_bullets_list(exp["tailored_bullets"])
                if "key_achievement" in exp:
                    exp["key_achievement"] = _sanitize_bullets_list(exp["key_achievement"])
    if "certifications" in data and isinstance(data["certifications"], list):
        clean_certs = []
        for c in data["certifications"]:
            if isinstance(c, dict):
                clean_certs.append(" - ".join(str(v) for v in c.values() if v))
            else:
                clean_certs.append(str(c))
        data["certifications"] = clean_certs
    return data

def _parse_json(content: str) -> dict:
    """Robustly extract the first JSON object from LLM output."""
    raw_json = content
    if "```json" in content:
        raw_json = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        raw_json = content.split("```")[1].split("```")[0]
    
    match = re.search(r'\{.*\}', raw_json, re.DOTALL)
    if match:
        raw = match.group(0)
        raw = re.sub(r',(\s*[}\]])', r'\1', raw)
        try:
            return _sanitize_dict(json.loads(raw))
        except json.JSONDecodeError:
            pass
    try:
        return _sanitize_dict(json.loads(raw_json.strip()))
    except:
        return {}


def _fmt_exp(exp: dict) -> dict:
    """Normalise an experience entry for prompt serialisation."""
    ach = exp.get("key_achievement") or exp.get("tailored_bullets") or ""
    if isinstance(ach, list):
        ach = " | ".join(str(a) for a in ach)
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
    skills = [str(s).lower() for s in (persona.get("top_skills") or [])]
    summary = str(persona.get("summary") or "").lower()
    exp_text = " ".join([
        f"{e.get('role','')} {e.get('company','')} {' '.join(str(b) for b in (e.get('tailored_bullets') or e.get('key_achievement') or [])) if isinstance((e.get('tailored_bullets') or e.get('key_achievement')), list) else str(e.get('tailored_bullets') or e.get('key_achievement',''))}"
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
    async def run(self, persona: Dict[str, Any], job_description: str, target_industry: str = "", focus_area: str = "", template: str = "professional"):
        experiences = [
            _fmt_exp(e)
            for e in (persona.get("experience_highlights") or [])[:8]
        ]
        candidate = {
            "name":          persona.get("full_name", ""),
            "title":         persona.get("professional_title", ""),
            "summary":       str(persona.get("summary", ""))[:1500],
            "skills":        (persona.get("top_skills") or [])[:25],
            "experience":    experiences,
            "projects":      (persona.get("projects") or [])[:6],
            "education":     (persona.get("education") or [])[:3],
            "certifications": (persona.get("certifications") or [])[:8],
        }
        # Give the LLM a full view of the JD
        slim_jd = str(job_description)[:1500]

        industry_prompt = f"- Align the vocabulary and metrics to the {target_industry} industry standard." if target_industry else ""
        focus_prompt = f"- Give special emphasis to {focus_area} in the summary and bullets." if focus_area else ""

        # ── Template-specific tailoring instructions ──────────────────────────
        if template == "executive":
            template_rules = """- Strategic executive narrative summary: positioning statement, career arc, top 3 strategic achievements, leadership philosophy.
- Reframed skills as leadership domains (P&L Management, Enterprise Sales, etc).
- Experience: write ALL bullet points as leadership-impact STAR statements (Scope -> Action -> Result). Ensure 4-6 quantitative bullets per role.
- Tone: authoritative, visionary, board-room ready."""
        elif template == "fresher":
            template_rules = """- Compelling Career Objective summary: mention target role, learning mindset, and value.
- NEVER repeat the candidate's name in the summary. Use implied pronouns (e.g., "Highly motivated engineer...").
- Skills: concrete tool/tech names ONLY. NO sentences, long phrases, or project names.
- Experience: write 3-4 bullets framing contributions -> tech used -> outcome (even small metrics).
- Projects: rich and results-oriented. Mention tools used, scale, and problem solved.
- Tone: ambitious, enthusiastic, growth-focused."""
        else:
            template_rules = """- Rich 5-7 sentence professional summary: domain expertise, top strengths, problems solved, and value proposition.
- NEVER repeat the candidate's name in the summary. Use implied pronouns (e.g., "Experienced engineer with a proven track record...").
- Exactly matching JD keywords into the skills list. Skills MUST be short, recognizable technical skills ONLY (e.g., Python, SQL). NEVER include long phrases or project names.
- Experience: write ALL bullet points as powerful STAR-format ATS-optimised statements.
- Tone: professional, confident, results-focused. Quantify everything possible."""

        async def tailor_narrative():
            prompt = f"""You are an expert resume writer. Write a highly tailored PROFESSIONAL SUMMARY and SKILLS LIST for this candidate applying to the specific job below.

QUALITY RULES:
{template_rules}
{industry_prompt}
{focus_prompt}
- NEVER invent new skills. You MUST select strictly from the Candidate Skills list provided.
- Output ONLY valid JSON.

Candidate Data:
{json.dumps({"name": candidate["name"], "title": candidate["title"], "summary": candidate["summary"], "skills": candidate["skills"]})}

Job Description:
{slim_jd}

Required JSON:
{{"tailored_summary": "Rich 5-7 sentence tailored summary...", "tailored_skills": ["skill1", "skill2..."]}}"""
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
            return _parse_json(resp["replies"][0])

        async def tailor_experience():
            if not experiences:
                return {"tailored_experience": []}

            # Create deterministic mapping
            mapped_exps = []
            payload_for_llm = []
            
            for i, exp in enumerate(experiences):
                exp_dict = dict(exp) if isinstance(exp, dict) else exp
                bullets = exp_dict.get("tailored_bullets") or exp_dict.get("highlights") or []
                if isinstance(bullets, str):
                    bullets = [bullets]
                
                payload_for_llm.append({
                    "id": i,
                    "bullets": bullets
                })
                # Keep exact original data for reconstruction
                mapped_exps.append({
                    "role": exp_dict.get("role", "Unknown"),
                    "company": exp_dict.get("company", "Unknown"),
                    "duration": exp_dict.get("period") or exp_dict.get("duration", "Unknown")
                })

            prompt = f"""You are an expert resume writer. Rewrite the bullet points for the following {len(payload_for_llm)} roles to explicitly target the provided Job Description.

CRITICAL RULES (MUST FOLLOW):
{template_rules}
{industry_prompt}
{focus_prompt}
- You MUST output ALL {len(payload_for_llm)} items provided below. Do NOT drop any IDs.
- Keep the exact "id" for each role in your output.
- ONLY rewrite the bullet points. Generate 4-6 rich STAR bullets per role (Action Verb + task + quantified result).
- Each bullet MUST be a plain string.
- Output ONLY valid JSON.

Roles to Rewrite (preserve ALL IDs):
{json.dumps(payload_for_llm, indent=2)}

Job Description:
{slim_jd}

Required JSON (output ALL {len(payload_for_llm)} items):
{{
  "tailored_bullets": [
    {{"id": 0, "bullets": ["STAR bullet 1", "STAR bullet 2"]}},
    {{"id": 1, "bullets": ["STAR bullet 1"]}}
  ]
}}"""
            loop = asyncio.get_event_loop()
            try:
                resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
                llm_res = _parse_json(resp["replies"][0])
            except Exception as e:
                logger.error(f"Tailor experience LLM failed: {e}")
                llm_res = {}
            
            tailored_bullets_list = llm_res.get("tailored_bullets", [])
            bullets_by_id = {}
            for item in tailored_bullets_list:
                if isinstance(item, dict) and "id" in item:
                    bullets_by_id[item["id"]] = item.get("bullets", [])

            for i, exp in enumerate(mapped_exps):
                llm_bullets = bullets_by_id.get(i)
                if llm_bullets and isinstance(llm_bullets, list) and len(llm_bullets) > 0:
                     exp["tailored_bullets"] = [str(b) for b in llm_bullets]
                else:
                    original = dict(experiences[i]) if i < len(experiences) else {}
                    exp["tailored_bullets"] = original.get("tailored_bullets") or original.get("highlights") or []
                    
            return {"tailored_experience": mapped_exps}

        async def tailor_projects():
            if not candidate["projects"]:
                return {"tailored_projects": []}
            prompt = f"""You are an expert resume writer. Rewrite the candidate's PROJECTS to highlight skills relevant to the Job Description.

QUALITY RULES:
{template_rules}
- Specifically mention technologies from the JD if the candidate used them in these projects.
- Make project descriptions rich (2-3 sentences), covering problem solved, tech used, and outcome.
- Output ONLY valid JSON.

Candidate Projects:
{json.dumps(candidate["projects"])}

Job Description:
{slim_jd}

Required JSON:
{{"tailored_projects": [{{"name": "Project Name", "description": "Rich 2-3 sentence description showcasing relevant skills"}}]}}"""
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
            return _parse_json(resp["replies"][0])

        try:
            # Run the three complex tailoring tasks concurrently
            nar_res, exp_res, proj_res = await asyncio.gather(
                tailor_narrative(),
                tailor_experience(),
                tailor_projects()
            )

            # Build result with explicit fallbacks — never let empty LLM output blank the resume
            result = {
                # Identity fields — ALWAYS pass through from persona
                "full_name":           persona.get("full_name", ""),
                "professional_title":  persona.get("professional_title", ""),
                "email":               persona.get("email", ""),
                "phone":               persona.get("phone", ""),
                "location":            persona.get("location", ""),
                "linkedin":            persona.get("linkedin", ""),
                "portfolio_url":       persona.get("portfolio_url", ""),
                # Tailored content — use LLM result OR fallback to original persona
                "tailored_summary":    nar_res.get("tailored_summary") or persona.get("summary", ""),
                "tailored_skills":     nar_res.get("tailored_skills") or persona.get("top_skills", []),
                "tailored_experience": exp_res.get("tailored_experience") or experiences,
                "tailored_projects":   proj_res.get("tailored_projects") or candidate["projects"],
                "education":           candidate["education"],
                "certifications":      candidate["certifications"],
            }

            # Python-level fast deterministic computation
            result["gap_analysis"] = _compute_gap_analysis(persona, job_description)
            result["match_analysis"] = "Candidate possesses strong foundational alignment. See summary for details."
            
            return {"tailored_result": result}
            
        except Exception as e:
            logger.error(f"Tailoring failed: {e}")
            return {"tailored_result": {
                "full_name":           persona.get("full_name", ""),
                "professional_title":  persona.get("professional_title", ""),
                "email":               persona.get("email", ""),
                "phone":               persona.get("phone", ""),
                "location":            persona.get("location", ""),
                "linkedin":            persona.get("linkedin", ""),
                "portfolio_url":       persona.get("portfolio_url", ""),
                "tailored_summary":    persona.get("summary", ""),
                "tailored_skills":     persona.get("top_skills", []),
                "tailored_experience": [_fmt_exp(e) for e in (persona.get("experience_highlights") or [])],
                "tailored_projects":   persona.get("projects", []),
                "education":           persona.get("education", []),
                "certifications":      persona.get("certifications", []),
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

        prompt = f"""Write a professional cover letter for a candidate named {name}, whose current title is {title}, applying to the role described below.

Rules:
{industry_prompt}
{focus_prompt}
- MAXIMUM 150 words total. Be crisp and punchy.
- 2 short paragraphs only: (1) intro + value proposition, (2) call to action.
- Mention 2-3 specific skills: {', '.join(str(s) for s in top3)}.
- Do NOT exceed 150 words under any circumstance.
- Start directly with "Dear Hiring Manager," — no header, no date, no address.
- End with "Sincerely,\\n{name}".
- IMPORTANT: "{name}" is the CANDIDATE's name, NOT a company name. Never write "at {name}" — that is wrong.
- If the company name is mentioned in the Job Description, use it. Otherwise use a generic opening like "I am writing to express my interest in the open position..." — do NOT use placeholders like [Company Name].
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
                f"expertise in {', '.join(str(s) for s in top3)} and a strong track record of delivering results. "
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
        slim_jd  = str(job_description)[:1000]

        tailored_summary = persona.get("summary") or persona.get("tailored_summary", "")
        tailored_skills  = persona.get("top_skills") or persona.get("tailored_skills", [])
        tailored_exp     = []
        for e in (persona.get("experience_highlights") or persona.get("tailored_experience") or [])[:8]:
            blist = e.get("tailored_bullets") or e.get("key_achievement") or []
            if isinstance(blist, str):
                blist = [b.strip() for b in blist.replace(";", "\n").split("\n") if b.strip()]
            tailored_exp.append({
                "role": e.get("role", ""), "company": e.get("company", ""),
                "duration": e.get("duration", ""), "bullets": blist,
            })

        if template == "executive":
            tone_rules = """- Tone: authoritative, board-room ready, no first-person pronouns.
- Summary: 6-8 sentence strategic executive narrative (vision, career arc, impact, leadership philosophy, value proposition).
- Competencies: 12 leadership domain phrases (not tool names).
- Bullets: KEEP ALL bullets — scope (team/budget/revenue) then measurable outcome. 4-6 per role."""
        elif template == "fresher":
            tone_rules = f"""- Rewrite summary as Career Objective: 3-4 sentences — target role, strongest qualification, what you bring, and ambition.
- Skills: concrete tool/tech names only.
- Bullets per role: {'3' if compact else '4'} — frame as learning + tangible delivery + tool used.
- Emphasize projects heavily — make descriptions specific, 2-3 sentences each.
- Tone: ambitious, eager, forward-looking."""
        else:
            tone_rules = f"""- Tone: clean, confident, professional, ATS-optimised.
- Summary: {'4-5' if compact else '5-7'} sentences — role, top strengths, problem-solving approach, domain experience, value proposition.
- Bullets: STAR format — action verb → specific task/project → quantified outcome. {'3' if compact else '4-6'} per role.
- Skills: include all skills relevant to JD."""

        page_rules = f"""- Page format: {'1-PAGE COMPACT: Keep content focused but still RICH. Summary: 4-5 sentences. Bullets: 3 per role max. Skills: top 12.' if compact else '2-PAGE FULL DETAIL: Include EVERYTHING. Full summary. All bullets. All skills. All projects. All certifications. Be comprehensive and expansive — the goal is to fill 2 pages with high-quality content.'}"""

        prompt = f"""You are an expert resume editor making final quality improvements to this {template.upper()} resume for {page_count} page(s).
Your job is to polish and expand the content — make it rich, professional, and impactful. Do NOT invent content, but DO elaborate, strengthen, and improve what is given.

Quality rules:
{tone_rules}
{page_rules}

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent new skills that are not in the Skills list below.
- NEVER repeat the candidate's name in the summary. Use implied pronouns (e.g., "Experienced AI Engineer...").
- Skills list MUST ONLY contain concise, targeted technical tools (e.g. Python, SQL). Remove any long phrases, sentences, or project names from the skills array.
- DO NOT duplicate entries. Each skill must appear exactly once.

Content to finalize (use ALL of this as a base — do not drop sections):
Summary: {tailored_summary[:2000]}
Skills: {', '.join(str(s) for s in tailored_skills[:25])}
JD context (for keyword alignment): {slim_jd}

Output ONLY valid JSON:
{{"tailored_summary":"rich final summary text","tailored_skills":["skill1","skill2"]}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result   = _parse_json(content)
            # Always pass identity fields through from persona
            for id_key in ("full_name", "professional_title", "email", "phone", "location", "linkedin", "portfolio_url"):
                result.setdefault(id_key, persona.get(id_key, ""))
            # Ensure tailored fields have fallbacks
            if not result.get("tailored_summary"):
                result["tailored_summary"] = tailored_summary
            if not result.get("tailored_skills"):
                result["tailored_skills"] = tailored_skills
            # Strictly hardcode the deterministic experience array
            result["tailored_experience"] = tailored_exp
            result.setdefault("tailored_projects", persona.get("projects") or persona.get("tailored_projects", []))
            result.setdefault("education", persona.get("education", []))
            result.setdefault("certifications", persona.get("certifications", []))
            result["cover_letter"] = persona.get("cover_letter", "")
            if "gap_analysis" in persona:
                result["gap_analysis"] = persona["gap_analysis"]
            elif "gap_analysis" not in result:
                result["gap_analysis"] = []
            return {"final_result": result}
        except Exception as e:
            logger.error(f"Finalize failed: {e}")
            return {"final_result": {
                "full_name":           persona.get("full_name", ""),
                "professional_title":  persona.get("professional_title", ""),
                "email":               persona.get("email", ""),
                "phone":               persona.get("phone", ""),
                "location":            persona.get("location", ""),
                "linkedin":            persona.get("linkedin", ""),
                "portfolio_url":       persona.get("portfolio_url", ""),
                "tailored_summary":    tailored_summary,
                "tailored_skills":     tailored_skills,
                "tailored_experience": tailored_exp,
                "tailored_projects":   persona.get("projects") or persona.get("tailored_projects", []),
                "education":           persona.get("education", []),
                "certifications":      persona.get("certifications", []),
                "cover_letter":        persona.get("cover_letter", ""),
                "gap_analysis":        persona.get("gap_analysis", []),
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

    async def extract_persona(self, resume_text: str) -> Dict[str, Any]:
        """
        Extract a structured professional persona from resume text using a Parallel Chunked Architecture.
        Splits extraction into Core Identity, Experience, and Credentials for maximum quality from local LLMs.
        """
        # Pass up to 6000 chars to cover full 2-page resumes without missing content
        resume_snippet = str(resume_text).strip()[:6000]

        async def extract_core():
            prompt = f"""You are a professional resume parser. Extract the CORE IDENTITY from this resume completely and accurately.
Resume text:
{resume_snippet}

Required JSON structure (extract ONLY these fields):
{{
  "full_name": "Full name (ONLY the candidate's actual name, NOT their city, location, or contact details)",
  "professional_title": "Current/most-recent job title",
  "years_experience": 0,
  "email": "email address",
  "phone": "phone number",
  "location": "city, country",
  "linkedin": "full linkedin URL if present, else empty string",
  "portfolio_url": "portfolio/github URL if present, else empty string",
  "summary": "Write a detailed 5-7 sentence professional bio covering: (1) career level and domain, (2) top 3 technical strengths, (3) types of problems solved, (4) industries or company types worked in, (5) leadership or collaboration style, (6) most notable career achievement. Be specific and use the candidate's actual experience.",
  "top_skills": ["List ONLY exact, concise, recognizable technical skills (e.g. Python, SQL). DO NOT extract long phrases, project names, or generic bullet points"],
  "career_level": "Entry/Mid/Senior/Exec",
  "suggested_roles": ["Role 1", "Role 2"]
}}

Return ONLY the JSON object, no other text:"""
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
            return _parse_json(resp["replies"][0])

        async def extract_experience():
            prompt = f"""You are a professional resume parser. Extract ONLY the PROFESSIONAL EXPERIENCE from this resume thoroughly and comprehensively. Do NOT merge distinct roles.
Resume text:
{resume_snippet}

Required JSON structure:
{{
  "experience_highlights": [
    {{
      "role": "Exact job title",
      "company": "Exact company name",
      "duration": "Start date - End date",
      "tailored_bullets": [
        "3-5 specific, detailed achievement bullets from this role. Each bullet: action verb + what you did + quantified impact. Extract real details from the resume text.",
        "Include metrics (%, $, team size, scale) wherever the resume mentions them.",
        "Do NOT generalize. Copy actual achievements from the resume text."
      ]
    }}
  ]
}}

DO NOT duplicate entries. Extract each entry exactly once.

Return ONLY the JSON object, no other text:"""
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
            return _parse_json(resp["replies"][0])

        async def extract_credentials():
            prompt = f"""You are a professional resume parser. Extract ONLY the CREDENTIALS (Projects, Education, Certifications, Awards, Languages) completely and accurately. DO NOT drop any items.
Resume text:
{resume_snippet}

Required JSON structure:
{{
  "projects": [
    {{"name": "Project Name", "description": "2-3 sentence description: what was built, technologies used, and impact or outcome"}}
  ],
  "education": [{{"degree": "Degree name", "school": "University/College name", "year": "Graduation year"}}],
  "certifications": ["List all certifications and licenses mentioned. Extract every single one."],
  "awards": ["List any awards, honours, or recognition mentioned"],
  "languages": ["List spoken languages if mentioned"]
}}

DO NOT duplicate entries. Extract each entry exactly once.

Return ONLY the JSON object, no other text:"""
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
            return _parse_json(resp["replies"][0])

        try:
            # Run all 3 extractions in parallel
            core_res, exp_res, cred_res = await asyncio.gather(
                extract_core(),
                extract_experience(),
                extract_credentials()
            )

            # Merge results into a single persona dictionary
            result = {**core_res, **exp_res, **cred_res}

            # Ensure contact fields exist to prevent UI errors
            result.setdefault("email", "")
            result.setdefault("phone", "")
            result.setdefault("linkedin", "")
            result.setdefault("portfolio_url", "")
            result.setdefault("summary", "")
            result.setdefault("top_skills", [])
            result.setdefault("experience_highlights", [])
            result.setdefault("projects", [])
            result.setdefault("education", [])
            result.setdefault("certifications", [])

            return result
        except Exception as e:
            logger.error(f"Persona parallel extraction failed: {e}")
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

        # tailor_comp.run is now an async pipeline, so await it directly
        tailor_result = await tailor_comp.run(
            persona=persona, 
            job_description=job_description, 
            target_industry=target_industry, 
            focus_area=focus_area, 
            template=template
        )
        
        # Cover letter is still sync
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
