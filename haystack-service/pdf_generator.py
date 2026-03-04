"""
Professional PDF Generator for CareerGini
Two premium templates:
  • professional  — Clean navy single-column. ATS-optimised. Industry-standard.
  • executive     — Charcoal + platinum-gold. Leadership-impact layout with competency grid.

Supports 1-page (compact) and 2-page (full-detail) for both templates.
Section ORDER is identical between sizes; only density changes.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Image,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import base64, io, logging, os
from typing import Dict, Any, List, Optional
from latex_generator import generate_pdf_latex

logger = logging.getLogger(__name__)
PAGE_W, PAGE_H = letter  # 612 × 792 pt

# ─────────────────────────────────────────────────────────────────────────────
# Font registration
# ─────────────────────────────────────────────────────────────────────────────
_FONT_DIR = "/usr/share/fonts/truetype/liberation"
_FONTS_REGISTERED = False


def _ensure_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    try:
        pdfmetrics.registerFont(TTFont("LiberationSans",         os.path.join(_FONT_DIR, "LiberationSans-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("LiberationSans-Bold",    os.path.join(_FONT_DIR, "LiberationSans-Bold.ttf")))
        pdfmetrics.registerFont(TTFont("LiberationSans-Italic",  os.path.join(_FONT_DIR, "LiberationSans-Italic.ttf")))
        pdfmetrics.registerFont(TTFont("LiberationSans-BoldItalic", os.path.join(_FONT_DIR, "LiberationSans-BoldItalic.ttf")))
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily(
            "LiberationSans",
            normal="LiberationSans",
            bold="LiberationSans-Bold",
            italic="LiberationSans-Italic",
            boldItalic="LiberationSans-BoldItalic",
        )
        _FONTS_REGISTERED = True
        logger.info("Liberation Sans TTF fonts registered.")
    except Exception as e:
        logger.warning(f"TTF font registration failed ({e}), falling back to Helvetica.")


def _font(variant: str = "regular") -> str:
    if _FONTS_REGISTERED:
        return {"regular": "LiberationSans", "bold": "LiberationSans-Bold",
                "italic": "LiberationSans-Italic", "bolditalic": "LiberationSans-BoldItalic"}.get(variant, "LiberationSans")
    return {"regular": "Helvetica", "bold": "Helvetica-Bold",
            "italic": "Helvetica-Oblique", "bolditalic": "Helvetica-BoldOblique"}.get(variant, "Helvetica")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def parse_base64_image(b64: str, w: float = 1.1 * inch, h: float = 1.1 * inch):
    try:
        if "," in b64:
            b64 = b64.split(",")[1]
        data = base64.b64decode(b64)
        buf = io.BytesIO(data)
        from PIL import Image as PI
        PI.open(buf).verify()
        buf.seek(0)
        return Image(buf, width=w, height=h)
    except Exception as e:
        logger.warning(f"Image failed: {e}")
        return None


def _bullets(exp: dict) -> List[str]:
    """Extract bullet points from an experience entry. Handles list and string formats.
    Checks tailored_bullets, bullets (from FinalizeComponent), and key_achievement.
    """
    raw = (exp.get("tailored_bullets")
           or exp.get("bullets")
           or exp.get("key_achievement")
           or [])
    if isinstance(raw, list):
        return [str(b).strip() for b in raw if str(b).strip()]
    # Handle semicolon or newline-separated string
    raw_str = str(raw).strip()
    for sep in ["\n", ";"]:
        parts = [b.strip() for b in raw_str.split(sep) if b.strip()]
        if len(parts) > 1:
            return parts
    return [raw_str] if raw_str else []


def _clean_duration(duration: str) -> str:
    """Sanitize duration strings from LLM output."""
    d = str(duration or "").strip()
    # Remove artefacts like 'None', 'null', placeholder quotes
    if d.lower() in ("none", "null", "n/a", "", "not specified", "(not specified)"):
        return ""
    # Remove surrounding quotes
    d = d.strip('"\'')
    return d


def _ps(name: str, **kw) -> ParagraphStyle:
    return ParagraphStyle(name=name, **kw)


def _clean(v) -> str:
    return str(v or "").replace("Not specified", "").replace("(Not specified)", "").strip()


# ─────────────────────────────────────────────────────────────────────────────
# Style factory
# ─────────────────────────────────────────────────────────────────────────────

def build_styles(template: str, page_count: int) -> dict:
    """Return all ParagraphStyles + palette metadata for the given template/page."""
    compact = (page_count == 1)
    BF  = _font("regular")
    BFB = _font("bold")
    BFI = _font("italic")

    # ── Size scale (shared) ──────────────────────────────────────────────────
    name_sz  = 22 if compact else 30
    ttl_sz   = 11 if compact else 13
    con_sz   = 8.5 if compact else 9.5
    sec_sz   = 9.5 if compact else 11
    body_sz  = 9   if compact else 10.5
    role_sz  = 9.5 if compact else 11
    co_sz    = 8.5 if compact else 10
    bl_sz    = 9   if compact else 10.5

    name_lead = round(name_sz * 1.15)
    body_lead = round(body_sz * 1.55)
    bl_lead   = round(bl_sz  * 1.55)
    role_lead = round(role_sz * 1.4)
    co_lead   = round(co_sz  * 1.4)
    sec_lead  = round(sec_sz  * 1.4)
    ttl_lead  = round(ttl_sz  * 1.4)

    sp_after_exp  = 5 if compact else 9
    sp_before_sec = 8 if compact else 16

    # ── Template palettes (MINIMALIST OVERHAUL) ──────────────────────────────
    # Focus on hierarchy through weighting and spacing, not color blocks.
    if template == "executive":
        accent   = colors.HexColor("#000000")   # Professional Black
        sub      = colors.HexColor("#444444")   # Deep Charcoal
        sec_bar  = colors.HexColor("#CCCCCC")   # Light Grey hairline
        link_col = colors.HexColor("#0000EE")
        name_align = TA_LEFT
    elif template == "fresher":
        accent   = colors.HexColor("#000000")   # Pure Black
        sub      = colors.HexColor("#555555")   # Medium Charcoal
        sec_bar  = colors.HexColor("#DDDDDD")   # Faint Separator
        link_col = colors.HexColor("#0000EE")
        name_align = TA_LEFT
    else:
        # Professional
        accent   = colors.HexColor("#121212")   # Near Black
        sub      = colors.HexColor("#555555")   # Cold Grey
        sec_bar  = colors.HexColor("#CCCCCC")   # Light Grey
        link_col = colors.HexColor("#0000EE")
        name_align = TA_LEFT

    S: Dict[str, Any] = {}

    S["name"] = _ps("name",
        fontName=BFB, fontSize=name_sz, leading=name_lead,
        textColor=accent, alignment=name_align, spaceAfter=2)

    S["title"] = _ps("title",
        fontName=BF, fontSize=ttl_sz, leading=ttl_lead,
        textColor=sub, alignment=TA_LEFT, spaceAfter=2)

    S["contact"] = _ps("contact",
        fontName=BF, fontSize=con_sz, leading=con_sz + 4,
        textColor=sub, alignment=TA_LEFT, spaceAfter=3)

    S["section"] = _ps("section",
        fontName=BFB, fontSize=sec_sz, leading=sec_lead,
        textColor=accent, spaceBefore=sp_before_sec, spaceAfter=1,
        textTransform="uppercase")

    S["body"] = _ps("body",
        fontName=BF, fontSize=body_sz, leading=body_lead,
        textColor=colors.HexColor("#222222"), alignment=TA_JUSTIFY, spaceAfter=3)

    S["body_left"] = _ps("body_left", parent=S["body"], alignment=TA_LEFT)
    S["body_bold"] = _ps("body_bold", parent=S["body"], fontName=BFB, alignment=TA_LEFT)

    S["role"] = _ps("role",
        fontName=BFB, fontSize=role_sz, leading=role_lead,
        spaceBefore=sp_after_exp, spaceAfter=1, textColor=accent)

    S["company"] = _ps("company",
        fontName=BFI, fontSize=co_sz, leading=co_lead,
        spaceAfter=2, textColor=sub)

    S["bullet"] = _ps("bullet",
        fontName=BF, fontSize=bl_sz, leading=bl_lead,
        leftIndent=12, firstLineIndent=-12, spaceAfter=2,
        textColor=colors.HexColor("#222222"))

    S["competency"] = _ps("competency",
        fontName=BF, fontSize=max(8.5, body_sz - 0.5), leading=body_lead,
        textColor=colors.HexColor("#333333"), spaceAfter=1)

    # Metadata used by renderers
    S["_accent"]           = accent
    S["_sub"]              = sub
    S["_sec_bar"]          = sec_bar
    S["_link_col"]         = link_col
    S["_compact"]          = compact
    S["_body_sz"]          = body_sz
    S["_sp_exp"]           = sp_after_exp
    S["_hr_thickness"]     = 0.25  # Force hairline
    S["_template"]         = template

    return S


# ─────────────────────────────────────────────────────────────────────────────
# Shared flowable helpers
# ─────────────────────────────────────────────────────────────────────────────

def _section_header(label: str, S: dict) -> List:
    items = [Paragraph(label.upper(), S["section"])]
    # Use ultra-thin hairline for professional separation
    items.append(HRFlowable(
        width="100%",
        thickness=0.25,
        color=S["_sec_bar"],
        spaceAfter=4,
    ))
    return items


def _contact_line(persona: dict, S: dict) -> List:
    """Build a contact info line with clickable hyperlinks."""
    parts = []
    for key in ("email", "phone", "location", "linkedin", "portfolio_url"):
        v = _clean(persona.get(key))
        if not v:
            continue
        if key in ("linkedin", "portfolio_url"):
            url = v if str(v).startswith("http") else "https://" + str(v)
            parts.append(f'<link href="{url}"><font color="#2563EB">{v}</font></link>')
        else:
            parts.append(v)
    if parts:
        return [Paragraph("  ·  ".join(parts), S["contact"])]
    return []


def _exp_block(exp: dict, S: dict, max_bullets: Optional[int] = None) -> List:
    """Render a single experience entry.
    Layout:
      Role (bold, accent)
      Company  ·  Duration  (italic, sub-colour)
      • Bullet 1
      • Bullet 2
    """
    role     = _clean(exp.get("role") or exp.get("title") or "")
    company  = _clean(exp.get("company") or exp.get("organization") or "")
    duration = _clean_duration(exp.get("duration") or exp.get("period") or exp.get("dates") or "")
    blist    = _bullets(exp)
    if max_bullets:
        blist = blist[:max_bullets]

    items = []
    if role:
        items.append(Paragraph(role, S["role"]))
    # Company and duration on the same line, clearly formatted
    comp_parts = [p for p in [company, duration] if p]
    if comp_parts:
        items.append(Paragraph("  ·  ".join(comp_parts), S["company"]))
    elif company:
        items.append(Paragraph(company, S["company"]))
    for b in blist:
        safe_b = b.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        items.append(Paragraph(f"\u2022\u00a0{safe_b}", S["bullet"]))
    items.append(Spacer(1, S["_sp_exp"]))
    return items



def _education_block(persona: dict, S: dict) -> List:
    """Render education entries. Handles multiple LLM field name variants.
    Always shows: Degree (bold) | School | Year — each clearly separated.
    """
    items = []
    for edu in (persona.get("education") or []):
        # Handle multiple field name variants from different LLM outputs
        degree  = _clean(edu.get("degree")  or edu.get("qualification") or edu.get("program") or "")
        school  = _clean(edu.get("school")  or edu.get("institution")   or edu.get("university") or edu.get("college") or "")
        year    = _clean(edu.get("year")    or edu.get("graduation_year") or edu.get("end_year") or edu.get("date") or "")
        subject = _clean(edu.get("subject") or edu.get("field") or edu.get("major") or "")

        if not (degree or school):
            continue

        # Line 1: Degree  (School)  Year — all on one line, clearly formatted
        line_parts = []
        if degree:
            line_parts.append(f"<b>{degree}</b>")
            if subject:
                line_parts[-1] += f" <i>in {subject}</i>"
        if school:
            line_parts.append(school)
        line1 = "  |  ".join(line_parts)
        if year:
            line1 += f"  ({year})"
        items.append(Paragraph(line1, S["body_left"]))
        items.append(Spacer(1, 4))
    return items


def _skills_grid(skills: List[Any], S: dict, cols: int = 2) -> List:
    """Render skills. If categorized (dicts), renders as a list. If flat (strings), renders as grid."""
    if not skills:
        return []
        
    # Categorized rendering
    if isinstance(skills[0], dict):
        items = []
        for cat in skills:
            if not isinstance(cat, dict): continue
            c_name = cat.get("category", "")
            c_items = cat.get("skills", cat.get("items", []))
            if not c_name or not c_items: continue
            skills_str = ", ".join(str(s) for s in c_items)
            text = f"<b>{c_name}:</b> {skills_str}"
            items.append(Paragraph(f"\u2022\u00a0{text}", S["bullet"]))
        if items:
            items.append(Spacer(1, 4))
        return items

    rows, row = [], []
    for i, sk in enumerate(skills):
        row.append(Paragraph(f"•\u00a0{sk}", S["bullet"]))
        if len(row) == cols or i == len(skills) - 1:
            while len(row) < cols:
                row.append(Paragraph("", S["bullet"]))
            rows.append(row)
            row = []
    if not rows:
        return []
    col_width = (PAGE_W - 2 * 0.42 * inch) / cols
    tbl = Table(rows, colWidths=[col_width] * cols)
    tbl.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "LEFT"),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    return [tbl, Spacer(1, 4)]


def _competency_grid(skills: List[Any], S: dict, cols: int = 3) -> List:
    """3-column grid for Executive template — visual weight without losing ATS. Support categorized skills."""
    if not skills: return []
    
    if isinstance(skills[0], dict):
        items = []
        for cat in skills:
            if not isinstance(cat, dict): continue
            c_name = cat.get("category", "")
            c_items = cat.get("skills", cat.get("items", []))
            if not c_name or not c_items: continue
            skills_str = ", ".join(str(s) for s in c_items)
            text = f"<b>{c_name}:</b> {skills_str}"
            items.append(Paragraph(f"\u25b8  {text}", S["competency"]))
        if items:
            items.append(Spacer(1, 4))
        return items

    rows, row = [], []
    for i, sk in enumerate(skills):
        row.append(Paragraph(f"\u25b8  {sk}", S["competency"]))
        if len(row) == cols or i == len(skills) - 1:
            while len(row) < cols:
                row.append(Paragraph("", S["competency"]))
            rows.append(row)
            row = []
    if not rows:
        return []
    tbl = Table(rows, colWidths=["33.33%"] * cols)
    tbl.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "LEFT"),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 2),
    ]))
    return [tbl, Spacer(1, 4)]



# ─────────────────────────────────────────────────────────────────────────────
# Template-specific renderers
# ─────────────────────────────────────────────────────────────────────────────

def _render_professional(story: List, persona: dict, S: dict, compact: bool):
    """
    Professionally Crafted — clean single-column layout.
    Section order (same for 1 & 2 page):
      Header → Professional Summary → Core Skills → Work Experience →
      Projects → Education → Certifications → Awards → Languages
    """
    # 1-page: 3 bullets/role, 14 skills; 2-page: all bullets, all skills
    max_bullets = 3 if compact else None
    max_skills  = 14 if compact else None
    skills = (persona.get("top_skills") or [])[:max_skills] if max_skills else (persona.get("top_skills") or [])

    # ── Header ───────────────────────────────────────────────────────────────
    story.append(Paragraph(_clean(persona.get("full_name")), S["name"]))
    story.append(Paragraph(_clean(persona.get("professional_title")), S["title"]))
    story.extend(_contact_line(persona, S))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.5,
                            color=S["_sec_bar"], spaceAfter=6))

    # ── Summary ──────────────────────────────────────────────────────────────
    summary = _clean(persona.get("summary"))
    if summary:
        story.extend(_section_header("Professional Summary", S))
        # For compact: first 4 sentences to keep density, 
        # full content for 2-page
        if compact:
            sentences = [s.strip() for s in summary.replace("!", ".").replace("?", ".").split(".") if s.strip()]
            summary = ". ".join(sentences[:4]) + "." if sentences else summary
        story.append(Paragraph(summary, S["body"]))
        story.append(Spacer(1, 2))

    # ── Core Skills ──────────────────────────────────────────────────────────
    if skills:
        story.extend(_section_header("Core Skills", S))
        story.extend(_skills_grid(skills, S, cols=2))

    # ── Work Experience ──────────────────────────────────────────────────────
    exps = persona.get("experience_highlights") or []
    if exps:
        story.extend(_section_header("Work Experience", S))
        for exp in exps:
            story.append(KeepTogether(_exp_block(exp, S, max_bullets=max_bullets)))

    # ── Projects (ALWAYS shown on both 1-page and 2-page) ────────────────────
    projects = persona.get("projects") or persona.get("tailored_projects") or []
    if projects:
        story.extend(_section_header("Projects", S))
        # On 1-page show first 2 projects; on 2-page show all
        show_projs = projects[:2] if compact else projects
        for proj in show_projs:
            name = _clean(proj.get("name") or proj.get("title") or "")
            desc = _clean(proj.get("description") or proj.get("summary") or "")
            tech = _clean(proj.get("technologies") or proj.get("tech_stack") or proj.get("tools") or "")
            if name:
                story.append(Paragraph(f"<b>{name}</b>", S["body_bold"]))
            line2_parts = []
            if tech:
                line2_parts.append(f"<i>{tech}</i>")
            if line2_parts:
                story.append(Paragraph(" | ".join(line2_parts), S["company"]))
            if desc:
                story.append(Paragraph(desc, S["body_left"]))
            story.append(Spacer(1, 5))

    # ── Education ────────────────────────────────────────────────────────────
    if persona.get("education"):
        story.extend(_section_header("Education", S))
        story.extend(_education_block(persona, S))

    # ── Certifications (always shown if present) ─────────────────────────────
    certs = persona.get("certifications") or []
    if certs:
        story.extend(_section_header("Certifications", S))
        for c in certs:
            story.append(Paragraph(f"\u2022\u00a0{_clean(c)}", S["bullet"]))

    # ── Awards & Languages (2-page only) ─────────────────────────────────────
    if not compact:
        awards = persona.get("awards") or []
        if awards:
            story.extend(_section_header("Awards & Recognition", S))
            for a in awards:
                story.append(Paragraph(f"\u2022\u00a0{_clean(a)}", S["bullet"]))
        languages = persona.get("languages") or []
        if languages:
            story.extend(_section_header("Languages", S))
            story.append(Paragraph(", ".join([_clean(l) for l in languages]), S["body_left"]))



def _render_executive(story: List, persona: dict, S: dict, compact: bool):
    """
    Executive Level — charcoal + platinum-gold, leadership-impact layout.

    Section order (same for 1 & 2 page):
      Header → Executive Profile → Core Competencies (grid) →
      Career Timeline → Education → Achievements/Projects* → Certifications*
    (* 2-page only)
    """
    max_bullets     = 3 if compact else None
    max_competencies = 9 if compact else 12
    skills = (persona.get("top_skills") or [])[:max_competencies]

    # ── Header — name left, contact right ────────────────────────────────────
    name      = _clean(persona.get("full_name"))
    title_txt = _clean(persona.get("professional_title"))

    # Build contact string
    contact_parts = []
    for key in ("email", "phone", "location", "linkedin", "portfolio_url"):
        v = _clean(persona.get(key))
        if not v:
            continue
        if key in ("linkedin", "portfolio_url"):
            url = v if str(v).startswith("http") else "https://" + str(v)
            contact_parts.append(f'<link href="{url}"><font color="#444444">{v}</font></link>')
        else:
            contact_parts.append(v)

    S_contact_right = _ps("contact_right",
        fontName=_font("regular"), fontSize=S["_body_sz"] - 1,
        leading=S["_body_sz"] + 3,
        textColor=colors.HexColor("#555555"), alignment=TA_RIGHT, spaceAfter=2)

    if contact_parts:
        hdr_tbl = Table(
            [[Paragraph(name, S["name"]), Paragraph("<br/>".join(contact_parts), S_contact_right)]],
            colWidths=["60%", "40%"],
        )
        hdr_tbl.setStyle(TableStyle([
            ("ALIGN",   (0, 0), (0, 0), "LEFT"),
            ("ALIGN",   (1, 0), (1, 0), "RIGHT"),
            ("VALIGN",  (0, 0), (-1, -1), "BOTTOM"),
            ("LEFTPADDING",  (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING",   (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
        ]))
        story.append(hdr_tbl)
    else:
        story.append(Paragraph(name, S["name"]))

    if title_txt:
        story.append(Paragraph(title_txt, S["title"]))

    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.25, color=S["_sec_bar"], spaceAfter=4))

    # ── Executive Profile (summary) ──────────────────────────────────────────
    summary = _clean(persona.get("summary"))
    if summary:
        story.extend(_section_header("Executive Profile", S))
        if compact:
            # Condense to 3 sentences
            sentences = [s.strip() for s in summary.replace("!", ".|").replace("?", ".|").split(".") if s.strip()]
            summary = ". ".join(sentences[:3]) + ("." if sentences else "")
        story.append(Paragraph(summary, S["body"]))
        story.append(Spacer(1, 2))

    # ── Core Competencies ────────────────────────────────────────────────────
    if skills:
        story.extend(_section_header("Core Competencies", S))
        story.extend(_competency_grid(skills, S, cols=3))

    # ── Career Timeline ──────────────────────────────────────────────────────
    exps = persona.get("experience_highlights") or []
    if exps:
        story.extend(_section_header("Career Timeline", S))
        for exp in exps:
            story.append(KeepTogether(_exp_block(exp, S, max_bullets=max_bullets)))

    # ── Education ────────────────────────────────────────────────────────────
    if persona.get("education"):
        story.extend(_section_header("Education", S))
        story.extend(_education_block(persona, S))

    # ── Achievements / Projects (2-page only) ────────────────────────────────
    if not compact and persona.get("projects"):
        story.extend(_section_header("Key Achievements & Projects", S))
        for proj in (persona.get("projects") or []):
            name = _clean(proj.get("name"))
            desc = _clean(proj.get("description"))
            if name: story.append(Paragraph(f"<b>{name}</b>", S["body_bold"]))
            if desc: story.append(Paragraph(desc, S["body_left"]))
            story.append(Spacer(1, 4))

    # ── Certifications (always shown if present) ─────────────────────────────
    certs = persona.get("certifications") or []
    if certs:
        story.extend(_section_header("Certifications & Credentials", S))
        for c in certs:
            story.append(Paragraph(f"•\u00a0{_clean(c)}", S["bullet"]))

    # ── Awards & Languages (2-page only) ─────────────────────────────────────
    if not compact:
        awards = persona.get("awards") or []
        if awards:
            story.extend(_section_header("Awards & Recognition", S))
            for a in awards:
                story.append(Paragraph(f"•\u00a0{_clean(a)}", S["bullet"]))
        languages = persona.get("languages") or []
        if languages:
            story.extend(_section_header("Languages", S))
            story.append(Paragraph(", ".join([_clean(l) for l in languages]), S["body_left"]))



# ─────────────────────────────────────────────────────────────────────────────
# Fresher renderer
# ─────────────────────────────────────────────────────────────────────────────

def _render_fresher(story: List, persona: dict, S: dict, compact: bool):
    """
    Fresher — teal, education-first, portfolio-forward layout.

    Section order (same for 1 & 2 page):
      Header → Career Objective → Education → Skills (tag grid) →
      Projects → Work Experience (if any) → Certifications*
    (* 2-page only)
    """
    max_bullets = 2 if compact else 3
    max_skills  = 6 if compact else 12
    max_projects = 2 if compact else None
    skills = (persona.get("top_skills") or [])[:max_skills]

    # ── Header ───────────────────────────────────────────────────────────────
    story.append(Paragraph(_clean(persona.get("full_name")), S["name"]))
    story.append(Paragraph(_clean(persona.get("professional_title")), S["title"]))
    story.extend(_contact_line(persona, S))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=0.25,
                            color=S["_sec_bar"], spaceAfter=4))

    # ── Career Objective ─────────────────────────────────────────────────────
    summary = _clean(persona.get("summary"))
    if summary:
        story.extend(_section_header("Career Objective", S))
        if compact:
            sentences = [s.strip() for s in summary.replace("!", ".|").replace("?", ".|").split(".") if s.strip()]
            summary = ". ".join(sentences[:2]) + ("." if sentences else "")
        story.append(Paragraph(summary, S["body"]))
        story.append(Spacer(1, 2))

    # ── Education (FIRST — most valuable asset for freshers) ─────────────────
    if persona.get("education"):
        story.extend(_section_header("Education", S))
        story.extend(_education_block(persona, S))

    # ── Skills (Clean List, No Boxes) ────────────────────────────────────────
    if skills:
        story.extend(_section_header("Technical Skills", S))
        if isinstance(skills[0], dict):
            for cat in skills:
                if not isinstance(cat, dict): continue
                c_name = cat.get("category", "")
                c_items = cat.get("skills", cat.get("items", []))
                if not c_name or not c_items: continue
                skills_str = ", ".join(str(s) for s in c_items)
                text = f"<b>{c_name}:</b> {skills_str}"
                story.append(Paragraph(f"• {text}", S["body_left"]))
        else:
            # Group skills by 3 per row for clean scanning, purely text-based
            cols = 3
            rows, row = [], []
            for i, sk in enumerate(skills):
                row.append(Paragraph(f"• {sk}", S["body_left"]))
                if len(row) == cols or i == len(skills) - 1:
                    while len(row) < cols: row.append(Paragraph("", S["body"]))
                    rows.append(row)
                    row = []
            if rows:
                tbl = Table(rows, colWidths=[f"{33}%"] * cols)
                tbl.setStyle(TableStyle([
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ]))
                story.append(tbl)
        story.append(Spacer(1, 4))

    # ── Projects (prominently placed — key differentiator for freshers) ───────
    projects = (persona.get("projects") or [])
    if max_projects:
        projects = projects[:max_projects]
    if projects:
        story.extend(_section_header("Projects & Academic Work", S))
        for proj in projects:
            name = _clean(proj.get("name"))
            desc = _clean(proj.get("description"))
            if name: story.append(Paragraph(f"<b>{name}</b>", S["body_bold"]))
            if desc: story.append(Paragraph(desc, S["body_left"]))
            story.append(Spacer(1, 4))

    # ── Work Experience (internships, part-time — shown if present) ───────────
    exps = persona.get("experience_highlights") or []
    if exps:
        story.extend(_section_header("Work Experience & Internships", S))
        for exp in exps:
            story.append(KeepTogether(_exp_block(exp, S, max_bullets=max_bullets)))

    # ── Certifications ────────────────────────────────────────────────────────
    if not compact and persona.get("certifications"):
        story.extend(_section_header("Certifications & Achievements", S))
        for c in (persona.get("certifications") or []):
            story.append(Paragraph(f"•\u00a0{_clean(c)}", S["bullet"]))


# ─────────────────────────────────────────────────────────────────────────────
# Cover letter
# ─────────────────────────────────────────────────────────────────────────────

def generate_cover_letter_pdf(
    output_path: str,
    persona: Dict[str, Any],
    template: str = "professional",
) -> bool:
    """Generate a clean cover letter PDF using the chosen template palette."""
    _ensure_fonts()
    ml = mr = 0.60 * inch
    mt = mb = 0.55 * inch

    S = build_styles(template, page_count=2)
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=ml, rightMargin=mr,
        topMargin=mt, bottomMargin=mb,
    )

    story: List = []
    story.append(Paragraph(_clean(persona.get("full_name")), S["name"]))
    story.extend(_contact_line(persona, S))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.25,
                            color=S["_sec_bar"], spaceAfter=20))

    cl = str(persona.get("cover_letter", "")).replace("\n", "<br/>")
    story.append(Paragraph(cl, S["body_left"]))

    try:
        import logging; logging.info(f'STORY LENGTH: {len(story)}');
        doc.build(story)
        logger.info(f"Cover Letter PDF → {output_path}")
        return True
    except Exception as e:
        logger.error(f"Cover Letter generation failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Main API
# ─────────────────────────────────────────────────────────────────────────────

def generate_pdf(
    output_path: str,
    persona: Dict[str, Any],
    template: str = "professional",
    profile_pic: Optional[str] = None,
    page_count: int = 2,
) -> bool:
    """
    Generate a professional resume PDF.

    template    'professional' | 'executive'
                (legacy values 'classic'/'modern'/'creative'/'minimalist'
                 are silently remapped to 'professional')

    page_count  1 = compact single-page  (smaller fonts, fewer bullets)
                2 = full-detail two-page (generous spacing, all content)

    Section ORDER is identical between 1-page and 2-page variants for both
    templates — only compactness/density differs.
    """
    _ensure_fonts()

    # Remap legacy template names
    if template not in ("professional", "executive", "fresher"):
        template = "professional"

    # TRY LATEX FIRST
    # try:
    #     success = generate_pdf_latex(output_path, persona, template, page_count)
    #     if success:
    #         return True
    #     logger.warning(f"LaTeX generation failed for {template}. Falling back to ReportLab.")
    # except Exception as e:
    #     logger.warning(f"LaTeX generation exception for {template}: {e}. Falling back to ReportLab.")

    compact = (page_count == 1)

    # ── Margins ──────────────────────────────────────────────────────────────
    if compact:
        ml = mr = 0.42 * inch
        mt = mb = 0.42 * inch
    else:
        ml = mr = 0.60 * inch
        mt = mb = 0.55 * inch

    # ── Normalise persona copy ────────────────────────────────────────────────
    persona = dict(persona)

    # Flatten tailored fields if present (from AI tailoring response)
    if "tailored_summary" in persona:
        persona["summary"] = persona["tailored_summary"]
    if "tailored_skills" in persona:
        persona["top_skills"] = persona["tailored_skills"]
    if "tailored_experience" in persona:
        persona["experience_highlights"] = persona["tailored_experience"]

    # For compact: enforce bullet limits at data layer too (belt-and-suspenders)
    if compact:
        exps = persona.get("experience_highlights") or []
        trimmed = []
        for exp in exps:
            exp = dict(exp)
            bullets = _bullets(exp)[:2]
            exp["tailored_bullets"] = bullets
            exp.pop("key_achievement", None)
            trimmed.append(exp)
        persona["experience_highlights"] = trimmed
        if persona.get("top_skills"):
            persona["top_skills"] = persona["top_skills"][:8]
        if persona.get("projects"):
            persona["projects"] = persona["projects"][:1]

    S = build_styles(template, page_count)

    try:
        story: List = []

        doc = SimpleDocTemplate(
            output_path, pagesize=letter,
            leftMargin=ml, rightMargin=mr,
            topMargin=mt, bottomMargin=mb,
        )

        if template == "executive":
            _render_executive(story, persona, S, compact)
        elif template == "fresher":
            _render_fresher(story, persona, S, compact)
        else:
            _render_professional(story, persona, S, compact)

        import logging; logging.info(f'STORY LENGTH: {len(story)}');
        doc.build(story)
        logger.info(f"PDF built → {output_path}  [{template}, {page_count}p, compact={compact}]")
        return True

    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise
