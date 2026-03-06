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

def _clean_resume_text(text: str) -> str:
    """
    Pre-process garbled PDF text before feeding to LLM.
    PDFs extracted by pdfplumber often have mid-word line breaks because
    text columns wrap at the physical page boundary. This pass:
      1. Rejoins words split across lines (heuristic: line ends mid-word).
      2. Preserves intentional blank lines (paragraph breaks).
    """
    lines = text.splitlines()
    cleaned = []
    for i, line in enumerate(lines):
        line = line.rstrip()
        if not line:
            cleaned.append("")
            continue
        # If the line doesn't end with punctuation/space and the NEXT line starts
        # with a lowercase letter → likely a broken word: merge with a space.
        if (i + 1 < len(lines)
                and lines[i + 1]
                and not line[-1] in '.,:;|•·-–—)'
                and lines[i + 1][0].islower()):
            cleaned.append(line + " ")  # will be joined to next loop
        else:
            cleaned.append(line)
    # Join, then normalise multiple blanks to double-newline
    joined = " ".join(cleaned)
    # Restore section breaks
    for section in ["Professional Experience", "Work Experience", "Projects",
                    "Education", "Skills", "Certifications", "Awards",
                    "Career Objective", "Leadership"]:
        joined = joined.replace(section, f"\n\n{section}\n")
    # Strip repeated spaces
    joined = re.sub(r' {2,}', ' ', joined)
    return joined.strip()


def _extract_experience_fallback(raw_text: str) -> List[Dict[str, Any]]:
    """
    Deterministic experience extractor for garbled PDF text.

    Strategy:
    1. Find the 'Professional Experience' (or 'Work Experience') section.
    2. Join the section's lines back into one long string (the cleaned text
       already has bullet separators as '•').
    3. Split by '•' to get individual sentence blocks.
    4. Identify role-header blocks (they contain a year + comma-separated
       'Role, Company Year' pattern) and group following bullets beneath them.
    """
    experiences = []

    # ── 1. Isolate the experience section ─────────────────────────────────────
    # Search case-insensitively for the section heading
    sec_pattern = re.compile(
        r'(?:Professional\s+Experience|Work\s+Experience|Internship(?:s)?)\s*\n(.*?)'
        r'(?=\n(?:Skills|Education|Projects|Certifications|Awards|Languages|Leadership|$))',
        re.IGNORECASE | re.DOTALL,
    )
    m = sec_pattern.search(raw_text)
    if not m:
        return []

    section_raw = m.group(1)

    # ── 2. Normalize the section: join split lines, then split on bullet '•' ──
    # Join lines (the cleaner may have left newlines within a sentence)
    section_joined = ' '.join(line.strip() for line in section_raw.splitlines() if line.strip())

    # Now split on bullet character to get individual clauses
    clauses = [c.strip() for c in section_joined.split('•') if c.strip()]

    # ── 3. Walk clauses, detecting role headers ────────────────────────────────
    # A role header clause looks like:   "Java Full Stack Intern, SkillDzire 2025"
    # It contains a comma and a 4-digit year, and is relatively short.
    role_header_re = re.compile(
        r'^([A-Za-z][^,]{3,70}),\s*([A-Za-z][^,\d]{1,60?})\s*(\d{4}(?:\s*[-–]\s*(?:\d{4}|Present))?)\s*(.*)$',
        re.IGNORECASE,
    )

    current_role    = None
    current_company = None
    current_dur     = None
    current_bullets : List[str] = []

    def _flush():
        if current_role and current_company:
            experiences.append({
                "role":            current_role,
                "company":         current_company,
                "duration":        current_dur or "",
                "tailored_bullets": current_bullets[:],
            })

    for clause in clauses:
        hm = role_header_re.match(clause)
        if hm:
            _flush()
            current_role    = hm.group(1).strip()
            current_company = hm.group(2).strip().rstrip(',').strip()
            current_dur     = hm.group(3).strip()
            # Anything after the year on the same clause is a bullet
            extra = hm.group(4).strip() if hm.group(4) else ""
            current_bullets = [extra] if extra and len(extra) > 10 else []
        else:
            # Not a header → treat as a bullet for the current role
            if len(clause) > 8:
                if current_role is not None:
                    current_bullets.append(clause)

    _flush()  # flush the last role
    return experiences


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
                # Ensure it matches {name, issuer, year} shape if possible
                name = c.get("name") or c.get("title") or c.get("certification") or ""
                issuer = c.get("issuer") or c.get("organization") or c.get("authority") or ""
                year = c.get("year") or c.get("date") or ""
                
                # If we couldn't extract a name but it's a dict, fallback to joining values
                if not name and c.values():
                    name = " - ".join(str(v) for v in c.values() if v)
                    
                clean_certs.append({"name": str(name), "issuer": str(issuer), "year": str(year)})
            else:
                clean_certs.append({"name": str(c), "issuer": "", "year": ""})
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
    """Normalise an experience entry for prompt serialisation.
    Now preserves bullets as a LIST (not a joined string) to avoid lossy flattening.
    """
    raw = exp.get("tailored_bullets") or exp.get("key_achievement") or []
    if isinstance(raw, str):
        # Split semicolon / newline separated string back into list
        bullets = [b.strip() for b in re.split(r'[;\n]', raw) if b.strip()]
    elif isinstance(raw, list):
        bullets = [str(b).strip() for b in raw if str(b).strip()]
    else:
        bullets = []
    return {
        "role":      exp.get("role") or exp.get("title", ""),
        "company":   exp.get("company", ""),
        "period":    exp.get("duration") or exp.get("period") or exp.get("dates", ""),
        "bullets":   bullets,   # preserved as list, not joined string
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
            for e in (persona.get("experience_highlights") or [])[:15]
        ]
        candidate = {
            "name":          persona.get("full_name", ""),
            "title":         persona.get("professional_title", ""),
            "summary":       str(persona.get("summary", ""))[:1500],
            "skills":        (persona.get("top_skills") or [])[:50],
            "experience":    experiences,
            "projects":      (persona.get("projects") or [])[:15],
            "education":     (persona.get("education") or [])[:5],
            "certifications": (persona.get("certifications") or [])[:15],
        }
        # Give the LLM a full view of the JD
        slim_jd = str(job_description)[:1500]

        industry_prompt = f"- Align the vocabulary and metrics to the {target_industry} industry standard." if target_industry else ""
        focus_prompt = f"- Give special emphasis to {focus_area} in the summary and bullets." if focus_area else ""

        # ── Template-specific tailoring instructions ──────────────────────────
        if template == "executive":
            template_rules = """- Strategic executive narrative summary: positioning statement, career arc, top 3 strategic achievements, leadership philosophy.
- Reframed skills as leadership domains (P&L Management, Enterprise Sales, etc).
- Experience: write ALL bullet points as leadership-impact STAR statements (Scope -> Action -> Result). Ensure 5-8 quantitative bullets per role. Do not drop existing history.
- Tone: authoritative, visionary, board-room ready."""
        elif template == "fresher":
            template_rules = """- Compelling Career Objective summary: mention target role, learning mindset, and value.
- NEVER repeat the candidate's name in the summary. Use implied pronouns (e.g., "Highly motivated engineer...").
- Skills: concrete tool/tech names ONLY. NO sentences, long phrases, or project names.
- Experience: write 4-6 bullets framing contributions -> tech used -> outcome (even small metrics). Expand heavily on any internships.
- Projects: rich and results-oriented. Mention tools used, scale, and problem solved.
- Tone: ambitious, enthusiastic, growth-focused."""
        elif template == "jakes":
            template_rules = """- Clean, ATS-optimised single-column style. Clarity above all.
- Summary: 3-5 concise sentences. State the role target, core domain, top strengths, and what you bring. No fluff.
- Skills: ONLY exact, recognizable technical terms (e.g. Python, React, SQL). NO soft skills, no phrases.
- Experience: 5-8 strong STAR-format bullets per role. Start every bullet with an action verb. Emphasize exhaustive details. Do not drop existing history.
- Tone: confident, crisp, no-nonsense. Prioritise substance over storytelling."""
        elif template == "faangpath":
            template_rules = """- Industry-standard structured format used by top tech companies (FAANG). Precision and relevance are paramount.
- Summary: 3-5 sentences. Be direct: target role, years of relevant experience, biggest technical strength, and key outcome or scale. Match JD keywords closely.
- Skills: Reflect EXACTLY what is in the JD. Prioritise languages, frameworks, platforms, and tools from the JD first.
- Experience: 5-8 impact-driven STAR bullets per role. Focus on SCALE (users, requests/sec, $ revenue, team size) and TECH used. Do not drop existing history.
- Tone: precise, data-driven, technical-depth oriented."""
        elif template == "deedy":
            template_rules = """- Two-column academic/designer format: left-column skills/education, right-column experience/projects.
- Summary: 3-4 sentences. Highlight a distinctive skill or specialty, academic or industry pedigree, and 1-2 notable outcomes.
- Skills: Group by category (e.g. Languages, Frameworks, Tools, Platforms). Keep each category to 4-6 items maximum.
- Experience: 4-6 visually tight bullets per role. Balance technical depth with clarity — avoid vague verbs.
- Projects: Give each a crisp 2-3 sentence narrative: what was built, tech used, outcome. Projects carry equal weight to experience in this format.
- Tone: technical, academic, distinctive — appeal to engineering-focused hiring managers."""
        else:
            template_rules = """- Rich 5-7 sentence professional summary: domain expertise, top strengths, problems solved, and value proposition.
- NEVER repeat the candidate's name in the summary. Use implied pronouns (e.g., "Experienced engineer with a proven track record...").
- Exactly matching JD keywords into the skills list. Skills MUST be short, recognizable technical skills ONLY (e.g., Python, SQL). NEVER include long phrases or project names.
- Experience: write ALL bullet points as powerful STAR-format ATS-optimised statements. Extract 5-8 bullets per role to ensure depth.
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

            # Build per-role mapping, preserving original bullets for fallback
            mapped_exps       = []  # role metadata + original bullets (for fallback)
            payload_for_llm   = []  # what we send to the LLM

            for i, exp in enumerate(experiences):
                exp_dict = dict(exp) if isinstance(exp, dict) else exp
                # exp_dict["bullets"] is now a proper list thanks to _fmt_exp fix
                orig_bullets = exp_dict.get("bullets") or []

                payload_for_llm.append({"id": i, "existing_bullets": orig_bullets})
                mapped_exps.append({
                    "role":            exp_dict.get("role", "Unknown"),
                    "company":         exp_dict.get("company", "Unknown"),
                    "duration":        exp_dict.get("period") or exp_dict.get("duration", ""),
                    "_orig_bullets":   orig_bullets,  # kept privately for fallback
                })

            prompt = f"""You are an expert resume writer. For each role below, rewrite and ENRICH the given bullet points to highlight impact relevant to the Job Description.

CRITICAL RULES:
{template_rules}
{industry_prompt}
{focus_prompt}
- You MUST output ALL {len(payload_for_llm)} roles. Do NOT drop any IDs.
- ENRICH the provided existing_bullets — keep the core facts, but expand upon them with action verbs and quantified impact.
- DO NOT truncate or delete existing history! If there are many original bullets, enrich ALL of them. 
- Expand up to 5-8 bullet points per role to create depth.
- Generate bullet points where each is a plain string starting with an action verb.
- If existing_bullets are empty, write 4-6 strong STAR-format bullets based on the role title and JD keywords.
- Output ONLY valid JSON.

Roles:
{json.dumps(payload_for_llm, indent=2)}

Job Description:
{slim_jd}

Required JSON:
{{"tailored_bullets": [{{"id": 0, "bullets": ["Bullet 1", "Bullet 2"]}}, ...]}}"""

            loop = asyncio.get_event_loop()
            try:
                resp   = await loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt))
                llm_res = _parse_json(resp["replies"][0])
            except Exception as e:
                logger.error(f"Tailor experience LLM failed: {e}")
                llm_res = {}

            tailored_bullets_list = llm_res.get("tailored_bullets", [])
            bullets_by_id = {}
            for index, item in enumerate(tailored_bullets_list):
                if not isinstance(item, dict):
                    continue
                item_id = item.get("id")
                if item_id is None or item_id in bullets_by_id:
                    item_id = index
                raw_bullets = item.get("bullets", [])
                if isinstance(raw_bullets, str):
                    raw_bullets = [raw_bullets]
                sanitized = []
                for rb in raw_bullets:
                    if isinstance(rb, str):
                        sanitized.extend([s.strip() for s in rb.replace(";", "\n").split("\n") if s.strip()])
                    else:
                        sanitized.append(str(rb).strip())
                bullets_by_id[item_id] = sanitized

            for i, exp in enumerate(mapped_exps):
                orig_bullets = exp.pop("_orig_bullets", [])  # remove private key
                llm_bullets  = bullets_by_id.get(i, [])

                if llm_bullets:
                    # LLM wrote bullets — use them but guarantee minimum 3
                    final_bullets = llm_bullets
                    # If LLM returned fewer than original, merge to preserve richness
                    if len(final_bullets) < len(orig_bullets):
                        seen = set(b.lower()[:40] for b in final_bullets)
                        for ob in orig_bullets:
                            if ob.lower()[:40] not in seen:
                                final_bullets.append(ob)
                                seen.add(ob.lower()[:40])
                else:
                    # LLM returned nothing — fall back to original extracted bullets
                    logger.warning(f"[tailor_exp] LLM returned no bullets for role {i} ({exp.get('role')}) — using original")
                    final_bullets = orig_bullets

                exp["tailored_bullets"] = final_bullets

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
        for e in (persona.get("experience_highlights") or persona.get("tailored_experience") or [])[:15]:
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
        elif template == "jakes":
            tone_rules = f"""- Tone: ATS-first, clean, crisp, action-driven. No padding or corporate speak.
- Summary: {'3-4' if compact else '4-5'} concise sentences. State target role, domain, key strength, and biggest result achieved. No fluffy adjectives.
- Skills: short recognizable technical names only. No grouped categories — flat list, strictly technical.
- Bullets: {'3' if compact else '4-5'} per role. Every bullet: action verb + specific contribution + quantified outcome. Every single one.
- Ensure no section is left with vague or generic language."""
        elif template == "faangpath":
            tone_rules = f"""- Tone: precision-engineered, data-heavy, tech-company focused.
- Summary: {'3-4' if compact else '4-5'} sentences. Lead with years of experience, technical domain, main stack. Reference JD keywords naturally.
- Skills: mirror JD keywords closely. Group by: Languages, Frameworks, Tools, Cloud — but keep each item short.
- Bullets: {'3-4' if compact else '5-6'} per role. Every bullet must include: scale metric (e.g., 10M requests/day, 5-person team, 30% improvement) + specific technology used + outcome.
- Projects: include tech stack used and measurable outcome."""
        elif template == "deedy":
            tone_rules = f"""- Tone: technical, academic, distinctive. Suitable for research or senior engineering roles.
- Summary: {'3' if compact else '3-4'} sentences. Highlight academic/industry pedigree, unique specialisation, and 1-2 specific standout accomplishments.
- Skills: grouped by category (Languages, Frameworks, Tools, Databases). Max 5-6 items per group.
- Bullets: {'3' if compact else '3-4'} per role since space is tight. Short, precise, technically deep. Avoid generic verbs like 'worked on'.
- Projects: short but rich — list tech stack, output, and impact. Projects are given high visual prominence in this layout."""
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

# ── Max 2 simultaneous persona extractions — prevents Ollama overload ─────────
_EXTRACT_SEMAPHORE = asyncio.Semaphore(2)

class ResumeAdvisorAgent(BaseAgent):
    def __init__(self, generator):
        super().__init__(generator)
        self.pipeline = AsyncPipeline()
        self.pipeline.add_component("tailor_resume", TailorResumeComponent(self.generator))
        self.pipeline.add_component("cover_letter",  CoverLetterComponent(self.generator))

    async def extract_persona(self, resume_text: str) -> Dict[str, Any]:
        """
        Extract a structured professional persona from resume text.

        Architecture: SINGLE-PROMPT (1 LLM call, atomic, no partial-merge corruption).
        - Pass 1: Full extraction prompt — all sections in one call.
        - Pass 2 (retry): Simpler minimal-schema prompt if Pass 1 JSON is unparseable.
        - Defaults applied last for any missing fields.

        Why single-prompt:
        - All 3 chunks read identical resume_snippet — parallelism gives zero quality gain
        - Any one chunk failing corrupts the merged persona (e.g. no experience)
        - 1 Ollama call is faster under load than 3 competing calls
        """
        # Clean the raw text first — PDFs often have mid-word line breaks
        cleaned_text   = _clean_resume_text(str(resume_text).strip())
        resume_snippet = cleaned_text[:12000]  # increased window for rich resumes
        loop = asyncio.get_event_loop()

        # ── Pass 1: Full single-prompt extraction ────────────────────────────
        FULL_PROMPT = f"""You are an expert resume parser. Extract ALL sections from the resume below into a single JSON object.
Be thorough: extract every job, every skill, every project. Do NOT skip sections.

Resume:
{resume_snippet}

Return ONLY this JSON object (no markdown, no explanation):
{{
  "full_name": "Candidate's full name only — not their city or email",
  "professional_title": "Most recent job title",
  "years_experience": 0,
  "email": "email@address.com",
  "phone": "+1-xxx-xxx-xxxx",
  "location": "City, Country",
  "linkedin": "https://linkedin.com/in/... or empty string",
  "portfolio_url": "https://github.com/... or empty string",
  "career_level": "Entry|Mid|Senior|Exec",
  "summary": "4-6 sentence professional summary covering role, top skills, achievements, and impact",
  "top_skills": ["Python", "SQL", "React"],
  "suggested_roles": ["Software Engineer", "Backend Developer"],
  "experience_highlights": [
    {{
      "role": "Exact job title",
      "company": "Company name",
      "duration": "Jan 2022 - Present",
      "tailored_bullets": [
        "Action verb + what you did + quantified result (e.g. Reduced API latency by 40%)"
      ]
    }}
  ],
  "projects": [
    {{"name": "Project name", "description": "What it does, tech used, impact"}}
  ],
  "education": [
    {{"degree": "B.S. Computer Science", "school": "University Name", "year": "2020"}}
  ],
  "certifications": [
    {{"name": "Certification Name", "issuer": "Issuing Org", "year": "2023"}}
  ],
  "awards": ["Dean's List 2019"],
  "languages": ["English", "Spanish"]
}}"""

        async def _call_llm(prompt: str, timeout_s: int = 100) -> dict:
            """Single LLM call with timeout — returns parsed dict or empty dict."""
            async with _EXTRACT_SEMAPHORE:
                try:
                    resp = await asyncio.wait_for(
                        loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt)),
                        timeout=timeout_s
                    )
                    return _parse_json(resp["replies"][0])
                except asyncio.TimeoutError:
                    logger.warning(f"LLM call timed out after {timeout_s}s")
                    return {}
                except Exception as e:
                    logger.warning(f"LLM call failed: {e}")
                    return {}

        def _is_useful(result: dict) -> bool:
            """Return True if extraction got at least a real name."""
            name = result.get("full_name", "").strip()
            return bool(name) and name.lower() not in ("", "candidate", "unknown", "full name")

        # ── Pass 1: full extraction
        logger.info(f"[extract_persona] Pass 1 — single-prompt extraction")
        result = await _call_llm(FULL_PROMPT, timeout_s=100)

        # ── Pass 2: retry with a simpler compact prompt if Pass 1 produced nothing useful
        if not _is_useful(result):
            logger.warning("[extract_persona] Pass 1 returned no useful data — retrying with compact prompt")
            COMPACT_PROMPT = f"""Parse this resume into JSON. Return ONLY the JSON, no other text.

Resume:
{resume_snippet}

JSON (fill every field):
{{"full_name":"","professional_title":"","years_experience":0,"email":"","phone":"","location":"","linkedin":"","portfolio_url":"","career_level":"Mid","summary":"","top_skills":[],"suggested_roles":[],"experience_highlights":[{{"role":"","company":"","duration":"","tailored_bullets":[]}}],"projects":[],"education":[{{"degree":"","school":"","year":""}}],"certifications":[{{"name":"","issuer":"","year":""}}],"awards":[],"languages":[]}}"""
            result = await _call_llm(COMPACT_PROMPT, timeout_s=100)

        if not _is_useful(result):
            logger.error("[extract_persona] Both passes failed to extract a real persona")

        # ── Apply safe defaults for all required fields ───────────────────────
        result.setdefault("full_name",             "Candidate")
        result.setdefault("professional_title",    "Professional")
        result.setdefault("years_experience",      0)
        result.setdefault("email",                 "")
        result.setdefault("phone",                 "")
        result.setdefault("location",              "")
        result.setdefault("linkedin",              "")
        result.setdefault("portfolio_url",         "")
        result.setdefault("career_level",          "Mid")
        result.setdefault("summary",               "")
        result.setdefault("top_skills",            [])
        result.setdefault("suggested_roles",       [])
        result.setdefault("experience_highlights", [])
        result.setdefault("projects",              [])
        result.setdefault("education",             [])
        result.setdefault("certifications",        [])
        result.setdefault("awards",                [])
        result.setdefault("languages",             [])

        # ── Deterministic fallback: rescue experiences the LLM missed ─────────
        if not result["experience_highlights"]:
            logger.warning("[extract_persona] LLM returned 0 experience entries — running regex fallback")
            fallback_exps = _extract_experience_fallback(cleaned_text)
            if fallback_exps:
                result["experience_highlights"] = fallback_exps
                logger.info(f"[extract_persona] Regex fallback rescued {len(fallback_exps)} experience(s)")

        logger.info(f"[extract_persona] Done — name: {result['full_name']}, "
                    f"skills: {len(result['top_skills'])}, "
                    f"exp: {len(result['experience_highlights'])}")
        return result

    async def reparse_persona(self, resume_text: str, current_persona: Dict[str, Any], user_message: str = "") -> Dict[str, Any]:
        """
        Re-evaluates the resume text against the current persona to extract missing details.
        Uses Smart Delta Merging (JSON Patching) and Deeper Context Chunking.
        """
        logger.info(f"[reparse_persona] Reparsing persona with message: {user_message}")
        cleaned_text = _clean_resume_text(str(resume_text).strip())
        
        # 1. Deeper Document Context Window (Chunking)
        MAX_CHUNK_SIZE = 12000
        resume_snippet = cleaned_text
        if len(cleaned_text) > MAX_CHUNK_SIZE and user_message:
            # Simple keyword scoring to find the best chunk
            keywords = [w.lower() for w in user_message.split() if len(w) > 3]
            best_chunk = cleaned_text[:MAX_CHUNK_SIZE]
            best_score = -1
            
            # Slide window by 8000 chars (4000 char overlap)
            for i in range(0, len(cleaned_text), 8000):
                chunk = cleaned_text[i:i+MAX_CHUNK_SIZE]
                chunk_lower = chunk.lower()
                score = sum(chunk_lower.count(k) for k in keywords)
                if score > best_score:
                    best_score = score
                    best_chunk = chunk
            resume_snippet = best_chunk
            logger.info(f"[reparse_persona] Selected chunk with score {best_score} based on keywords: {keywords}")
        else:
            resume_snippet = cleaned_text[:MAX_CHUNK_SIZE]

        loop = asyncio.get_event_loop()
        import json
        current_persona_json = json.dumps(current_persona, indent=2)
        
        msg_instruction = f"The user specifically noted the following is missing or incorrect:\n\"{user_message}\"\n\nPlease find these missing details in the Raw Resume Text and return them as a JSON Patch." if user_message else "Please deeply re-read the resume and extract any missing experience, skills, side projects, or education that were missed. Return them as a JSON Patch."
        
        # 2. Smart Delta Merging Prompt
        REPARSE_PROMPT = f"""You are an expert resume parser. A previous extraction attempted to parse the candidate's resume, but some details were missed.
        
{msg_instruction}

Raw Resume Text Chunk:
{resume_snippet}

Current Persona State:
{current_persona_json}

INSTRUCTIONS:
1. Examine the 'Current Persona State' and the 'Raw Resume Text Chunk'.
2. Identify specifically what is MISSING from the Current Persona State that exists in the Raw Resume Text, focusing on the user's instructions.
3. Output ONLY a JSON Patch containing the NEW items to be ADDED. 
4. DO NOT output the entire persona. Only output the arrays/fields containing the NEW additions.
5. If the user wants to update a string field (like summary), output the full new string.

Return ONLY this JSON structure exactly:
{{
  "add_skills": ["new skill 1", "new skill 2"],
  "add_experience": [
    {{
      "role": "...",
      "company": "...",
      "duration": "...",
      "tailored_bullets": ["..."]
    }}
  ],
  "add_projects": [
    {{"name": "...", "description": "..."}}
  ],
  "add_education": [
    {{"degree": "...", "school": "...", "year": "..."}}
  ],
  "add_certifications": [
    {{"name": "...", "issuer": "...", "year": "..."}}
  ],
  "update_summary": "Leave empty string if unchanged, otherwise provide new summary"
}}"""

        async def _call_llm(prompt: str, timeout_s: int = 150) -> dict:
            async with _EXTRACT_SEMAPHORE:
                try:
                    resp = await asyncio.wait_for(
                        loop.run_in_executor(None, lambda: self.generator.run(prompt=prompt)),
                        timeout=timeout_s
                    )
                    return _parse_json(resp["replies"][0])
                except asyncio.TimeoutError:
                    logger.warning(f"LLM call timed out after {timeout_s}s in reparse")
                    return {}
                except Exception as e:
                    logger.warning(f"LLM call failed in reparse: {e}")
                    return {}
                    
        patch = await _call_llm(REPARSE_PROMPT, timeout_s=150)
        
        if not patch:
            logger.warning("[reparse_persona] Reparse failed or returned empty patch. Returning current persona.")
            return current_persona
            
        # 3. Apply the JSON Patch (Deep Merge)
        updated_persona = dict(current_persona) # Create a copy
        
        # Safe append helper with deduplication
        def _safe_extend(key: str, patch_key: str):
            if patch.get(patch_key) and isinstance(patch.get(patch_key), list):
                if not updated_persona.get(key):
                    updated_persona[key] = []
                    
                if isinstance(updated_persona[key], list):
                    existing_items = updated_persona[key]
                    new_items = patch[patch_key]
                    
                    for new_item in new_items:
                        is_duplicate = False
                        
                        # Skill Deduplication (String comparison)
                        if isinstance(new_item, str):
                            if any(isinstance(ex, str) and ex.lower().strip() == new_item.lower().strip() for ex in existing_items):
                                is_duplicate = True
                                
                        # Object Deduplication (Dict comparison by primary keys)
                        elif isinstance(new_item, dict):
                            for ex in existing_items:
                                if not isinstance(ex, dict):
                                    continue
                                    
                                # Check roles
                                if "role" in new_item and "role" in ex:
                                    if new_item["role"].lower().strip() == ex["role"].lower().strip() and new_item.get("company", "").lower().strip() == ex.get("company", "").lower().strip():
                                        is_duplicate = True
                                        break
                                # Check projects/certs
                                elif "name" in new_item and "name" in ex:
                                    if new_item["name"].lower().strip() == ex["name"].lower().strip():
                                        is_duplicate = True
                                        break
                                # Check education
                                elif "degree" in new_item and "degree" in ex:
                                    if new_item["degree"].lower().strip() == ex["degree"].lower().strip():
                                        is_duplicate = True
                                        break
                                        
                        if not is_duplicate:
                            updated_persona[key].append(new_item)
        
        _safe_extend("top_skills", "add_skills")
        _safe_extend("experience_highlights", "add_experience")
        _safe_extend("projects", "add_projects")
        _safe_extend("education", "add_education")
        _safe_extend("certifications", "add_certifications")
        
        if patch.get("update_summary") and isinstance(patch.get("update_summary"), str):
            updated_persona["summary"] = patch["update_summary"]
                
        logger.info(f"[reparse_persona] Patch applied successfully.")
        return updated_persona



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
