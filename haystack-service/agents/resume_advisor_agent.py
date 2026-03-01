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
        # Pass the full authentic experience (up to 8 roles)
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
        # Give the LLM a full view of the JD — 1500 chars covers most postings
        slim_jd = str(job_description)[:1500]

        industry_prompt = f"- Align the vocabulary and metrics to the {target_industry} industry standard." if target_industry else ""
        focus_prompt = f"- Give special emphasis to {focus_area} in the summary and bullets." if focus_area else ""

        # ── Template-specific tailoring instructions ──────────────────────────
        if template == "executive":
            template_rules = """- Write ALL bullet points as leadership-impact STAR statements: Situation/Scope (team size, P&L, budget) → Action (what you led/designed/transformed) → quantified Result (revenue, growth %, cost saved, efficiency gained).
- Generate a powerful 6-8 sentence executive narrative summary: opening positioning statement, career arc spanning roles, top 3 strategic achievements with numbers, leadership philosophy, and forward-looking value proposition.
- Reframe skills as 12 leadership domains / competency areas (not tool names). E.g. "P&L Management", "M&A Integration", "Enterprise Sales", "Cross-Functional Leadership", "Digital Transformation", "Board Reporting".
- Generate 4-6 bullet points per role — each must include at least one quantified metric ($, %, headcount, time saved).
- Tone: authoritative, visionary, board-room ready. No first-person pronouns. Use strong verbs: Spearheaded, Orchestrated, Transformed, Galvanized."""
        elif template == "fresher":
            template_rules = """- Write a compelling Career Objective (3-4 sentences): mention target role, your strongest qualification, your learning mindset, and value you will bring.
- Emphasize academic achievements, thesis/dissertation work, coursework projects, hackathons, open-source contributions, and internships.
- Skills: include ALL specific concrete tool/technology names (Python, React, SQL, Figma, etc.) plus soft skills relevant to the JD.
- For internships or part-time work: write 3-4 bullets framing each as: what you contributed → specific technology used → measurable outcome (even if small: 'reduced page load time by 20%', 'delivered feature to 500 users').
- Projects: make descriptions rich and results-oriented — mention what problem it solved, tools used, scale, and what you learned.
- Tone: ambitious, enthusiastic, growth-focused, specific."""
        else:
            template_rules = """- Write ALL bullet points as powerful STAR-format ATS-optimised statements (strong action verb → specific task or project → quantified result with metric).
- Generate a rich 5-7 sentence professional summary: current title and domain expertise, top 3 technical strengths with context, the types and scale of problems you've solved, industries or company sizes you've worked in, and a memorable value proposition for the employer.
- Include exact keyword phrases from the JD in the skills list — maximize ATS match score.
- Generate 4-6 impactful, specific bullet points per role. Use real numbers from the candidate's history. Do NOT use vague phrases like 'improved performance' — specifics only.
- Tone: professional, confident, results-focused. Quantify everything possible."""

        prompt = f"""You are an expert professional resume writer with 15+ years of experience helping candidates land top roles.
Tailor this candidate's resume for the specific job below. Your output must be COMPREHENSIVE and DETAILED — the aim is to fill a full 1-2 page professional PDF document with rich, impactful content.

STRICT AUTHENTICITY RULES:
- DO NOT invent job titles, companies, projects, or dates. Only use what is in the candidate data.
- DO NOT add fake achievements. Only rewrite, strengthen, and quantify existing achievements with better language.
- If numbers/metrics aren't given, use reasonable relative language ("significantly", "substantially") or soft metrics ("used by the full engineering org", "cross-team collaboration").
- CONSOLIDATE: If duplicate entries for same Role+Company+Duration exist, MERGE into one entry. NEVER output duplicate roles.

QUALITY REQUIREMENTS:
- Bullet points MUST follow STAR format: Action Verb + specific task/project + quantified or described outcome.
- Summary MUST be substantive — at least 5 full sentences covering the candidate's full professional story.
- Skills list MUST include all relevant skills from both the candidate profile AND the JD keywords.
- Generate 4-6 bullets per role — be thorough, specific, and impressive.
{template_rules}
{industry_prompt}
{focus_prompt}

ADDITIONAL:
- Return Education and Certifications details exactly as provided.
- Tailor Project descriptions to emphasize skills/outcomes most relevant to the JD.
- If the JD requires skills/experiences missing from candidtae profile, add 1-3 specific actionable `gap_analysis` suggestions.
- Output ONLY valid JSON. No preamble or explanation.

Candidate:
{json.dumps(candidate)}

Job Description:
{slim_jd}

Required JSON:
{{"tailored_summary":"Rich 5-7 sentence summary","tailored_skills":["skill1","skill2"],"tailored_experience":[{{"role":"Exact role","company":"Exact company","duration":"Exact dates","tailored_bullets":["STAR bullet 1 — comprehensive","STAR bullet 2 — with metric","STAR bullet 3","STAR bullet 4"]}}],"tailored_projects":[{{"name":"Project Name","description":"Rich 2-3 sentence tailored description"}}],"education":[{{"degree":"Degree","school":"School","year":"Year"}}],"certifications":["cert1","cert2"],"match_analysis":"2-3 sentences on candidate fit and key strengths for this role","gap_analysis":["suggestion 1","suggestion 2"]}}"""

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

Content to finalize (use ALL of this as a base — do not drop sections):
Summary: {tailored_summary[:2000]}
Skills: {', '.join(tailored_skills[:25])}
Experience entries: {json.dumps(tailored_exp)}
JD context (for keyword alignment): {slim_jd}

Output ONLY valid JSON — preserve ALL experience entries, DO NOT drop any roles:
{{"tailored_summary":"rich final summary text","tailored_skills":["skill1","skill2"],"tailored_experience":[{{"role":"role","company":"company","duration":"duration","tailored_bullets":["rich STAR bullet 1","rich STAR bullet 2","rich STAR bullet 3"]}}]}}"""

        try:
            response = self.generator.run(prompt=prompt)
            content  = response["replies"][0]
            result   = _parse_json(content)
            result.setdefault("tailored_projects", persona.get("projects") or persona.get("tailored_projects", []))
            result.setdefault("education", persona.get("education", []))
            result["cover_letter"] = persona.get("cover_letter", "")
            if "gap_analysis" in persona:
                result["gap_analysis"] = persona["gap_analysis"]
            elif "gap_analysis" in result:
                pass 
            else:
                result["gap_analysis"] = []
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

    def extract_persona(self, resume_text: str) -> Dict[str, Any]:
        """
        Extract a structured professional persona from resume text.

        We pass up to 4000 chars (covers ~2-page PDF) so no section is lost.
        We then ask the model to extract compactly so the response stays fast.
        """
        # Pass up to 6000 chars to cover full 2-page resumes without missing content
        resume_snippet = str(resume_text).strip()[:6000]

        prompt = f"""You are a professional resume parser. Extract ALL structured information from this resume completely and accurately.
Resume text:
{resume_snippet}

Required JSON structure (extract ALL real info — be thorough and comprehensive):
{{
  "full_name": "Full name",
  "professional_title": "Current/most-recent job title",
  "years_experience": 0,
  "email": "email address",
  "phone": "phone number",
  "location": "city, country",
  "linkedin": "full linkedin URL if present, else empty string",
  "portfolio_url": "portfolio/github URL if present, else empty string",
  "summary": "Write a detailed 5-7 sentence professional bio covering: (1) career level and domain, (2) top 3 technical strengths, (3) types of problems solved, (4) industries or company types worked in, (5) leadership or collaboration style, (6) most notable career achievement. Be specific and use the candidate's actual experience.",
  "top_skills": ["List ALL technical and domain skills mentioned — tools, frameworks, languages, methodologies — aim for 15-25 skills"],
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
  ],
  "projects": [
    {{"name": "Project Name", "description": "2-3 sentence description: what was built, technologies used, and impact or outcome"}}
  ],
  "education": [{{"degree": "Degree name", "school": "University/College name", "year": "Graduation year"}}],
  "certifications": ["List all certifications and licenses mentioned"],
  "awards": ["List any awards, honours, or recognition mentioned"],
  "languages": ["List spoken languages if mentioned"],
  "career_level": "Entry/Mid/Senior/Exec",
  "suggested_roles": ["Role 1", "Role 2"]
}}"""

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
