"""
Professional PDF Generator for CareerGini
Embeds Liberation Sans TTF fonts for high-quality, richly-sized PDFs.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, BaseDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, Image, KeepTogether,
    PageTemplate, Frame, NextPageTemplate, FrameBreak,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from typing import Dict, Any, List, Optional
import base64, io, logging, os

logger = logging.getLogger(__name__)
PAGE_W, PAGE_H = letter          # 612 × 792 pt

# ─────────────────────────────────────────────────────────────────────────────
# Font registration (Liberation Sans — metrically identical to Arial)
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
        pdfmetrics.registerFont(TTFont("LiberationMono",         os.path.join(_FONT_DIR, "LiberationMono-Regular.ttf")))
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily(
            "LiberationSans",
            normal="LiberationSans",
            bold="LiberationSans-Bold",
            italic="LiberationSans-Italic",
            boldItalic="LiberationSans-BoldItalic",
        )
        _FONTS_REGISTERED = True
        logger.info("Liberation Sans TTF fonts registered successfully.")
    except Exception as e:
        logger.warning(f"TTF font registration failed ({e}), falling back to Helvetica.")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _font(variant: str = "regular") -> str:
    """Return the font name for the given variant, with graceful fallback."""
    if _FONTS_REGISTERED:
        m = {
            "regular":    "LiberationSans",
            "bold":       "LiberationSans-Bold",
            "italic":     "LiberationSans-Italic",
            "bolditalic": "LiberationSans-BoldItalic",
        }
        return m.get(variant, "LiberationSans")
    # fallback
    m = {
        "regular":    "Helvetica",
        "bold":       "Helvetica-Bold",
        "italic":     "Helvetica-Oblique",
        "bolditalic": "Helvetica-BoldOblique",
    }
    return m.get(variant, "Helvetica")


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
    raw = exp.get("key_achievement") or exp.get("tailored_bullets") or []
    if isinstance(raw, list):
        return [str(b).strip() for b in raw if str(b).strip()]
    return [b.strip() for b in str(raw).replace(";", "\n").split("\n") if b.strip()]


def _ps(name: str, **kw) -> ParagraphStyle:
    return ParagraphStyle(name=name, **kw)


# ─────────────────────────────────────────────────────────────────────────────
# Style factory
# ─────────────────────────────────────────────────────────────────────────────

def build_styles(template: str, page_count: int) -> dict:
    """Build all paragraph styles for the given template and page count."""
    compact = (page_count == 1)

    # ── Size scale ───────────────────────────────────────────────────
    name_sz  = 24 if compact else 32
    ttl_sz   = 12 if compact else 15
    con_sz   = 9  if compact else 10
    sec_sz   = 10 if compact else 12
    body_sz  = 9.5 if compact else 11
    role_sz  = 10 if compact else 12
    co_sz    = 9  if compact else 10.5
    bl_sz    = 9.5 if compact else 11

    name_lead = round(name_sz * 1.15)
    body_lead = round(body_sz * 1.5)
    bl_lead   = round(bl_sz * 1.5)
    role_lead = round(role_sz * 1.4)
    co_lead   = round(co_sz * 1.4)
    sec_lead  = round(sec_sz * 1.4)
    ttl_lead  = round(ttl_sz * 1.4)

    sp_after_exp  = 6  if compact else 10
    sp_before_sec = 10 if compact else 18

    # ── Template palette ─────────────────────────────────────────────
    if template == "classic":
        accent  = colors.HexColor("#1B2A4A")
        sub     = colors.HexColor("#4A4A4A")
        sec_bg  = None
        sec_bar = colors.HexColor("#1B2A4A")
        align   = TA_CENTER
    elif template == "modern":
        accent  = colors.HexColor("#1D3557")
        sub     = colors.HexColor("#457B9D")
        sec_bg  = None
        sec_bar = colors.HexColor("#457B9D")
        align   = TA_LEFT
    elif template == "creative":
        accent  = colors.HexColor("#5B21B6")
        sub     = colors.HexColor("#DC2626")
        sec_bg  = colors.HexColor("#1E1B4B")
        sec_bar = None
        align   = TA_CENTER
    elif template == "reference":
        accent  = colors.HexColor("#000000")
        sub     = colors.HexColor("#333333")
        sec_bg  = None
        sec_bar = colors.HexColor("#000000")
        align   = TA_LEFT
    else:  # minimalist
        accent  = colors.HexColor("#111111")
        sub     = colors.HexColor("#888888")
        sec_bg  = None
        sec_bar = colors.HexColor("#BBBBBB")
        align   = TA_LEFT

    BF  = _font("regular")
    BFB = _font("bold")
    BFI = _font("italic")

    S = {}

    S["name"] = _ps("name",
        fontName=BFB, fontSize=name_sz, leading=name_lead,
        textColor=accent, alignment=align, spaceAfter=4)

    S["title"] = _ps("title",
        fontName=BFI, fontSize=ttl_sz, leading=ttl_lead,
        textColor=sub, alignment=align, spaceAfter=3)

    S["contact"] = _ps("contact",
        fontName=BF, fontSize=con_sz, leading=con_sz + 4,
        textColor=colors.HexColor("#666666"), alignment=align, spaceAfter=4)

    sec_kw = dict(
        fontName=BFB, fontSize=sec_sz, leading=sec_lead,
        spaceBefore=sp_before_sec, spaceAfter=4,
    )
    if sec_bg:
        sec_kw.update(textColor=colors.white, backColor=sec_bg,
                      borderPadding=(3, 8, 3, 8))
    else:
        sec_kw["textColor"] = accent
    S["section"] = _ps("section", **sec_kw)
    S["_sec_bar"]  = sec_bar
    S["_sec_bg"]   = sec_bg
    S["_accent"]   = accent
    S["_compact"]  = compact
    S["_body_sz"]  = body_sz
    S["_sp_exp"]   = sp_after_exp

    S["body"] = _ps("body",
        fontName=BF, fontSize=body_sz, leading=body_lead,
        textColor=colors.HexColor("#2D2D2D"),
        alignment=TA_JUSTIFY, spaceAfter=4)

    S["body_left"] = _ps("body_left", parent=S["body"], alignment=TA_LEFT)
    S["body_bold"] = _ps("body_bold", parent=S["body"], fontName=BFB, alignment=TA_LEFT)

    S["role"] = _ps("role",
        fontName=BFB, fontSize=role_sz, leading=role_lead,
        spaceBefore=sp_after_exp, spaceAfter=1, textColor=accent)

    S["company"] = _ps("company",
        fontName=BFI, fontSize=co_sz, leading=co_lead,
        spaceAfter=3, textColor=colors.HexColor("#666666"))

    S["bullet"] = _ps("bullet",
        fontName=BF, fontSize=bl_sz, leading=bl_lead,
        leftIndent=16, firstLineIndent=0,
        spaceAfter=2, textColor=colors.HexColor("#2D2D2D"))

    S["sidebar"] = _ps("sidebar",
        fontName=BF, fontSize=max(8.5, body_sz - 1), leading=body_lead - 1,
        textColor=colors.HexColor("#444444"), spaceAfter=2)

    S["sidebar_bold"] = _ps("sidebar_bold",
        fontName=BFB, fontSize=max(9, sec_sz - 1), leading=body_lead,
        textColor=accent, spaceBefore=6, spaceAfter=1)

    S["sidebar_section"] = _ps("sidebar_section",
        fontName=BFB, fontSize=max(9, sec_sz - 1), leading=body_lead,
        textColor=accent, spaceBefore=10, spaceAfter=4)

    return S


# ─────────────────────────────────────────────────────────────────────────────
# Flowable helpers
# ─────────────────────────────────────────────────────────────────────────────

def _section_header(label: str, S: dict) -> List:
    items = [Paragraph(label.upper(), S["section"])]
    if S["_sec_bar"] and not S["_sec_bg"]:
        items.append(HRFlowable(
            width="100%",
            thickness=1.5 if not S["_compact"] else 1.0,
            color=S["_sec_bar"],
            spaceAfter=4,
        ))
    return items


def _exp_block(exp: dict, S: dict, creative: bool = False) -> List:
    role     = str(exp.get("role", "")).replace("Not specified", "").replace("(Not specified)", "").strip()
    company  = str(exp.get("company", "")).replace("Not specified", "").replace("(Not specified)", "").strip()
    duration = str(exp.get("duration", "")).replace("Not specified", "").replace("(Not specified)", "").strip()
    blist    = _bullets(exp)

    role_txt = f'<font color="#5B21B6">{role}</font>' if creative else role
    items = []
    if role:
        items.append(Paragraph(role_txt, S["role"]))
    
    comp_dur = []
    if company: comp_dur.append(company)
    if duration: comp_dur.append(duration)
    if comp_dur:
        items.append(Paragraph("  \u00b7  ".join(comp_dur), S["company"]))
    elif not role and blist:
        # Fallback spacing if no header at all
        items.append(Spacer(1, 4))
    for b in blist:
        items.append(Paragraph(f"\u2022\u00a0{b}", S["bullet"]))
    items.append(Spacer(1, S["_sp_exp"]))
    return items


# ─────────────────────────────────────────────────────────────────────────────
# Main API
# ─────────────────────────────────────────────────────────────────────────────

def generate_cover_letter_pdf(
    output_path: str,
    persona: Dict[str, Any],
    template: str = "classic",
) -> bool:
    """Generate a separate Cover Letter PDF."""
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

    name = persona.get("full_name", "")
    contacts = [p for p in [persona.get("email"), persona.get("phone"), persona.get("location")] if p]
    story.append(Paragraph(name, S["name"]))
    if contacts:
        story.append(Paragraph(" | ".join(contacts), S["contact"]))
    
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1.5, color=S["_accent"], spaceAfter=20))

    cl = str(persona.get("cover_letter", "")).replace("\n", "<br/>")
    story.append(Paragraph(cl, S["body_left"]))

    try:
        doc.build(story)
        logger.info(f"Cover Letter PDF built → {output_path}")
        return True
    except Exception as e:
        logger.error(f"Cover Letter generation failed: {e}")
        return False
        
        
def generate_pdf(
    output_path: str,
    persona: Dict[str, Any],
    template: str = "classic",
    profile_pic: Optional[str] = None,
    page_count: int = 2,
) -> bool:
    """
    Generate a professional resume PDF with embedded TTF fonts.

    page_count=1  Compact / single-page:
        • Smaller fonts (24→32pt name, 9.5→11pt body)
        • Tighter margins (0.40 in)
        • Max 2 bullets per role, top 8 skills

    page_count=2  Full detail / two-page:
        • Larger fonts, generous spacing
        • Standard margins (0.60 in)
        • All bullets and skills included
    """
    _ensure_fonts()
    compact = (page_count == 1)

    # ── Margins ──────────────────────────────────────────────────────
    if compact:
        ml = mr = 0.40 * inch
        mt = mb = 0.40 * inch
    else:
        ml = mr = 0.60 * inch
        mt = mb = 0.55 * inch

    # ── Trim for compact ─────────────────────────────────────────────
    persona = dict(persona)
    if compact:
        exps = persona.get("experience_highlights", [])
        trimmed = []
        for exp in exps:
            exp = dict(exp)
            exp["key_achievement"] = _bullets(exp)[:2]
            exp.pop("tailored_bullets", None)
            trimmed.append(exp)
        persona["experience_highlights"] = trimmed
        if persona.get("top_skills"):
            persona["top_skills"] = persona["top_skills"][:8]
        if persona.get("projects"):
            persona["projects"] = persona["projects"][:2]
    else:
        # Explicitly ensure we don't trim if not compact (pass full length)
        # But for 2-pages we explicitly use the full `tailored_bullets` instead of just `key_achievement`
        exps = persona.get("experience_highlights", [])
        full_detail = []
        for exp in exps:
            exp = dict(exp)
            full_detail.append(exp)
        persona["experience_highlights"] = full_detail

    S = build_styles(template, page_count)

    try:
        story: List = []

        # ── Doc setup ────────────────────────────────────────────────
        if template == "modern":
            doc = BaseDocTemplate(
                output_path, pagesize=letter,
                leftMargin=ml, rightMargin=mr,
                topMargin=mt, bottomMargin=mb,
            )
            usable_w  = PAGE_W - ml - mr
            sidebar_w = 2.1 * inch if compact else 2.4 * inch
            main_w    = usable_w - sidebar_w - 14
            divider_x = ml + sidebar_w + 7

            def _bg(canvas, doc):
                canvas.saveState()
                # Sidebar background
                canvas.setFillColor(colors.HexColor("#EEF3FA"))
                canvas.rect(0, 0, divider_x, PAGE_H, fill=1, stroke=0)
                # Vertical rule
                canvas.setStrokeColor(colors.HexColor("#AAC0D9"))
                canvas.setLineWidth(1)
                canvas.line(divider_x, mb, divider_x, PAGE_H - mt)
                canvas.restoreState()

            full_f = Frame(ml, mb, usable_w, PAGE_H - mt - mb, id="full")
            left_f = Frame(ml, mb, sidebar_w, PAGE_H - mt - mb,
                           id="left", rightPadding=10, topPadding=8)
            right_f = Frame(divider_x + 10, mb, main_w, PAGE_H - mt - mb,
                            id="right", leftPadding=10, topPadding=8)
            right_cont = Frame(divider_x + 10, mb, main_w, PAGE_H - mt - mb,
                               id="right_cont", leftPadding=10, topPadding=8)

            doc.addPageTemplates([
                PageTemplate(id="Cover", frames=[full_f]),
                PageTemplate(id="First", frames=[left_f, right_f], onPage=_bg),
                PageTemplate(id="Later", frames=[right_cont], onPage=_bg),
            ])
        else:
            doc = SimpleDocTemplate(
                output_path, pagesize=letter,
                leftMargin=ml, rightMargin=mr,
                topMargin=mt, bottomMargin=mb,
            )

        # ─────────────────────────────────────────────────────────────
        # MODERN — two-column sidebar
        # ─────────────────────────────────────────────────────────────
        if template == "modern":
            left:  List = []
            right: List = []

            # Photo
            if profile_pic:
                img = parse_base64_image(
                    profile_pic,
                    w=1.1 * inch if compact else 1.4 * inch,
                    h=1.1 * inch if compact else 1.4 * inch,
                )
                if img:
                    left.append(img)
                    left.append(Spacer(1, 8))

            left.append(Paragraph(persona.get("full_name", ""), S["name"]))
            left.append(Paragraph(persona.get("professional_title", ""), S["title"]))
            left.append(Spacer(1, 8))

            for key in ("email", "phone", "location"):
                v = persona.get(key)
                if v:
                    left.append(Paragraph(str(v), S["sidebar"]))

            if persona.get("top_skills"):
                left.extend(_section_header("Skills", S))
                for sk in persona["top_skills"]:
                    left.append(Paragraph(f"• {sk}", S["sidebar"]))

            if persona.get("education"):
                left.extend(_section_header("Education", S))
                for edu in persona["education"]:
                    d = str(edu.get('degree','')).replace("Not specified", "").strip()
                    sc = str(edu.get('school','')).replace("Not specified", "").strip()
                    yr = str(edu.get('year','')).replace("Not specified", "").strip()
                    if d:
                        left.append(Paragraph(f"<b>{d}</b>", S["sidebar_bold"]))
                    if sc:
                        left.append(Paragraph(sc, S["sidebar"]))
                    if yr:
                        left.append(Paragraph(yr, S["sidebar"]))
                    left.append(Spacer(1, 4))

            if persona.get("certifications"):
                left.extend(_section_header("Certifications", S))
                for c in persona["certifications"]:
                    left.append(Paragraph(f"• {c}", S["sidebar"]))

            # Right column
            if persona.get("summary"):
                right.extend(_section_header("Professional Summary", S))
                right.append(Paragraph(persona["summary"], S["body"]))
                right.append(Spacer(1, S["_sp_exp"]))

            if persona.get("experience_highlights"):
                right.extend(_section_header("Work Experience", S))
                for exp in persona["experience_highlights"]:
                    right.append(KeepTogether(_exp_block(exp, S)))
            
            if persona.get("projects"):
                right.extend(_section_header("Projects", S))
                for proj in persona["projects"]:
                    name = proj.get("name", "")
                    desc = proj.get("description", "")
                    if name: right.append(Paragraph(f"<b>{name}</b>", S["body_bold"]))
                    if desc: right.append(Paragraph(desc, S["body"]))
                    right.append(Spacer(1, S["_sp_exp"]))
            story.extend(left)
            story.append(FrameBreak())
            story.extend(right)

        # ─────────────────────────────────────────────────────────────
        # CLASSIC / CREATIVE / MINIMALIST — single column
        # ─────────────────────────────────────────────────────────────
        else:
            is_creative   = template == "creative"
            is_minimalist = template == "minimalist"

            # ── Header ───────────────────────────────────────────────
            name_p = Paragraph(persona.get("full_name", ""), S["name"])
            ttl_p  = Paragraph(persona.get("professional_title", ""), S["title"])
            contacts = [p for p in [
                persona.get("email"), persona.get("phone"), persona.get("location"),
            ] if p]
            con_p = Paragraph(" | ".join(contacts), S["contact"])

            if profile_pic:
                img = parse_base64_image(profile_pic,
                    w=1.1 * inch if compact else 1.4 * inch,
                    h=1.1 * inch if compact else 1.4 * inch)
                if img:
                    tbl = Table([[img, [name_p, ttl_p, con_p]]],
                                colWidths=[1.3 * inch if compact else 1.6 * inch, "*"])
                    tbl.setStyle(TableStyle([
                        ("ALIGN",  (0,0), (-1,-1), "LEFT"),
                        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                        ("LEFTPADDING", (1,0), (1,0), 10),
                        ("RIGHTPADDING", (0,0), (0,0), 0),
                    ]))
                    story.append(tbl)
                else:
                    story.extend([name_p, ttl_p, con_p])
            else:
                story.extend([name_p, ttl_p, con_p])

            # Header rule
            if is_creative:
                story.append(Spacer(1, 4))
                story.append(HRFlowable(width="100%", thickness=2.5,
                                        color=S["_accent"], spaceAfter=6))
            elif not is_minimalist:
                story.append(Spacer(1, 4))
                story.append(HRFlowable(width="100%", thickness=1.5,
                                        color=S["_accent"], spaceAfter=6))
            else:
                story.append(Spacer(1, 8))

            # ── Content Order Block ────────────────────────────────────────────────
            # We construct a pipeline array of callables to enforce strict layout ordering
            # For the 'reference' template, this is strictly: 
            #   Objective (Summary) -> Education -> Projects -> Experience -> Skills -> Certifications
            # For others, it remains the standard layout.
            
            def render_summary():
                if persona.get("summary"):
                    story.extend(_section_header("Professional Summary", S))
                    story.append(Paragraph(persona["summary"], S["body"]))
                    story.append(Spacer(1, 4))
            
            def render_education():
                if persona.get("education"):
                    story.extend(_section_header("Education", S))
                    for edu in persona["education"]:
                        d = str(edu.get("degree", "")).replace("Not specified", "").strip()
                        sc = str(edu.get("school", "")).replace("Not specified", "").strip()
                        yr = str(edu.get("year", "")).replace("Not specified", "").strip()
                        
                        parts = []
                        if d: parts.append(f"<b>{d}</b>")
                        if sc: parts.append(sc)
                        txt = ", ".join(parts)
                        if yr: txt += f"  ({yr})"
                        
                        txt = txt.replace("()", "").strip()
                        
                        if txt:
                            story.append(Paragraph(txt, S["body_left"]))
                            story.append(Spacer(1, 4))
            
            def render_projects():
                if persona.get("projects"):
                    story.extend(_section_header("Projects", S))
                    for proj in persona["projects"]:
                        name = proj.get("name", "")
                        desc = proj.get("description", "")
                        
                        if name:
                            story.append(Paragraph(f"<b>{name}</b>", S["body_bold"]))
                        if desc:
                            story.append(Paragraph(desc, S["body_left"]))
                        story.append(Spacer(1, 4))
            
            def render_experience():
                if persona.get("experience_highlights"):
                    story.extend(_section_header("Work Experience", S))
                    for exp in persona["experience_highlights"]:
                        story.append(
                            KeepTogether(_exp_block(exp, S, creative=is_creative))
                        )
            
            def render_skills():
                if persona.get("top_skills"):
                    story.extend(_section_header("Skills", S))
                    skills = persona["top_skills"]
    
                    if is_minimalist or template == "reference":
                        story.append(Paragraph(" · ".join(skills), S["body_left"]))
    
                    elif is_creative and not compact:
                        BF = _font("regular")
                        chip_s = _ps("chip",
                            fontName=BF, fontSize=S["_body_sz"] - 0.5,
                            leading=S["_body_sz"] + 5,
                            textColor=colors.HexColor("#5B21B6"),
                            borderColor=colors.HexColor("#5B21B6"),
                            borderWidth=0.75, borderPadding=(2, 7, 2, 7))
                        cols = 4
                        rows, row = [], []
                        for i, sk in enumerate(skills):
                            row.append(Paragraph(sk, chip_s))
                            if len(row) == cols or i == len(skills) - 1:
                                while len(row) < cols:
                                    row.append(Paragraph("", S["body"]))
                                rows.append(row)
                                row = []
                        if rows:
                            gt = Table(rows, colWidths=["25%"] * cols)
                            gt.setStyle(TableStyle([
                                ("ALIGN",         (0,0), (-1,-1), "LEFT"),
                                ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
                                ("BOTTOMPADDING", (0,0), (-1,-1), 5),
                                ("TOPPADDING",    (0,0), (-1,-1), 3),
                                ("ROWBACKGROUNDS", (0,0), (-1,-1),
                                 [colors.white, colors.HexColor("#FAF5FF")]),
                            ]))
                            story.append(gt)
                    else:
                        story.append(Paragraph(", ".join(skills), S["body_left"]))
    
                    story.append(Spacer(1, 4))
            
            def render_certifications():
                if persona.get("certifications"):
                    story.extend(_section_header("Certifications", S))
                    for c in persona["certifications"]:
                        story.append(Paragraph(f"• {c}", S["bullet"]))
            
            # Sequence enforcement
            render_summary()
            render_education()
            render_projects()
            render_experience()
            render_skills()
            render_certifications()

        # ── Build ────────────────────────────────────────────────────
        doc.build(story)
        logger.info(f"PDF built → {output_path}  [{template}, {page_count}p, compact={compact}]")
        return True

    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise
