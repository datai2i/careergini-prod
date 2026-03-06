import os
import subprocess
import logging
import tempfile
import json
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

def setup_jinja_env(template_dir: str) -> Environment:
    """Setup Jinja2 environment with LaTeX escaping."""
    env = Environment(
        loader=FileSystemLoader(template_dir),
        block_start_string='\\BLOCK{',
        block_end_string='}',
        variable_start_string='\\VAR{',
        variable_end_string='}',
        comment_start_string='\\#{',
        comment_end_string='}',
        line_statement_prefix='%%',
        line_comment_prefix='%#',
        trim_blocks=True,
        autoescape=False,
    )
    
    # Add custom filters
    def escape_latex(s: str) -> str:
        if not isinstance(s, str):
            return s
        commands = [
            ('\\', '\\textbackslash{}'),
            ('{', '\\{'),
            ('}', '\\}'),
            ('\\textbackslash\\{\\}', '\\textbackslash{}'),
            ('$', '\\$'),
            ('&', '\\&'),
            ('#', '\\#'),
            ('^', '\\textasciicircum{}'),
            ('_', '\\_'),
            ('~', '\\textasciitilde{}'),
            ('%', '\\%'),
        ]
        for char, rep in commands:
            s = s.replace(char, rep)
        return s
    
    env.filters['escape_latex'] = escape_latex
    return env


_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_TEMPLATE_DIR = os.path.join(_THIS_DIR, "latex_templates")

def generate_pdf_latex(
    output_path: str,
    persona: dict,
    template: str = "jakes",
    page_count: int = 2,
    template_dir: str = None
) -> bool:
    """
    Generate a PDF resume using LaTeX via Jinja2 templating.
    Supports styles: jakes, faangpath, deedy (new) and professional, executive, fresher (legacy).
    Each style applies distinct data shaping for optimal rendering.
    """
    if template not in ["jakes", "faangpath", "deedy", "professional", "executive", "fresher"]:
        template = "jakes"

    # Resolve template directory relative to this file so it always works
    # regardless of the calling process's working directory (CWD)
    if not template_dir:
        template_dir = _DEFAULT_TEMPLATE_DIR

    compact = (page_count == 1)

    template_file = f"{template}.tex.j2"
    template_path = os.path.join(template_dir, template_file)
    
    if not os.path.exists(template_path):
        logger.error(f"LaTeX template not found: {template_path}")
        return False

    env = setup_jinja_env(template_dir)
    
    try:
        jinja_template = env.get_template(template_file)
        # Flatten persona to match template format
        data = dict(persona)
        if "tailored_summary" in data:
            data["summary"] = data["tailored_summary"]
        if "tailored_skills" in data:
            data["top_skills"] = data["tailored_skills"]
        if "tailored_experience" in data:
            data["experience_highlights"] = data["tailored_experience"]
        # Resolve projects from either key
        if not data.get("projects") and data.get("tailored_projects"):
            data["projects"] = data["tailored_projects"]
            
        data['compact'] = compact

        # ── Per-style section ordering & data shaping ────────────────────────
        if template == "deedy":
            # Deedy two-column: skills should be grouped by category; projects are equally prominent
            raw_skills = data.get("top_skills", [])
            if raw_skills and isinstance(raw_skills[0], str):
                # LLM gave flat list — wrap it in a single category
                data["top_skills"] = [{"category": "Core Skills", "skills": raw_skills[:30]}]
            data["projects"] = (data.get("projects") or [])[:3 if compact else 10]

        elif template == "faangpath":
            # FAANGPath: group skills only if LLM returned plain list (fallback)
            raw_skills = data.get("top_skills", [])
            if raw_skills and isinstance(raw_skills[0], str):
                data["top_skills"] = [{"category": "Technical Skills", "skills": raw_skills[:40]}]
            data["projects"] = (data.get("projects") or [])[:3 if compact else 8]

        elif template == "jakes":
            # Jake's: flat skill list only, max 15 items; flatten grouped skills
            raw_skills = data.get("top_skills", [])
            flat_skills = []
            if raw_skills and isinstance(raw_skills[0], dict):
                for group in raw_skills:
                    flat_skills.extend(group.get("skills", []))
            else:
                flat_skills = raw_skills
            data["top_skills"] = flat_skills[:30]
            data["projects"] = (data.get("projects") or [])[:3 if compact else 8]

        else:
            # Legacy templates: wrap flat skills in a category if needed
            raw_skills = data.get("top_skills", [])
            if raw_skills and isinstance(raw_skills[0], str):
                data["top_skills"] = [{"category": None, "skills": raw_skills[:30]}]

        # ── Compact mode bullet trimming ─────────────────────────────────────
        if compact:
            exps = data.get("experience_highlights", [])
            trimmed = []
            bullet_limit = {"deedy": 3, "jakes": 3, "faangpath": 4}.get(template, 3)
            role_limit   = {"faangpath": 5, "executive": 5}.get(template, 4)

            for exp in exps[:role_limit]:
                exp_copy = dict(exp)
                raw_bl = exp_copy.get("tailored_bullets") or exp_copy.get("key_achievement") or []
                if isinstance(raw_bl, str):
                    bl = [b.strip() for b in raw_bl.replace(";", "\n").split("\n") if b.strip()]
                else:
                    bl = [str(b).strip() for b in raw_bl if str(b).strip()]
                exp_copy["tailored_bullets"] = bl[:bullet_limit]
                trimmed.append(exp_copy)
            data["experience_highlights"] = trimmed

        tex_content = jinja_template.render(**data)
        
        # Create a temporary directory for compilation
        with tempfile.TemporaryDirectory() as temp_dir:
            tex_file_path = os.path.join(temp_dir, "resume.tex")
            with open(tex_file_path, "w", encoding="utf-8") as f:
                f.write(tex_content)
                
            # Render and copy required .cls or .sty classes
            import glob
            import shutil
            for cls_tmpl in glob.glob(os.path.join(template_dir, "*.cls.j2")) + glob.glob(os.path.join(template_dir, "*.sty.j2")):
                base_name = os.path.basename(cls_tmpl).replace(".j2", "")
                try:
                    cls_content = env.get_template(os.path.basename(cls_tmpl)).render(**data)
                    with open(os.path.join(temp_dir, base_name), "w", encoding="utf-8") as f:
                        f.write(cls_content)
                except Exception as e:
                    logger.warning(f"Failed to render dependency {base_name}: {e}")
                    
            # Copy fonts directory if needed (e.g. for Deedy template)
            fonts_dir = os.path.join(template_dir, "fonts")
            if os.path.isdir(fonts_dir):
                shutil.copytree(fonts_dir, os.path.join(temp_dir, "fonts"))
                
            # Compile with xelatex (run twice to resolve layout references)
            cmd = ["xelatex", "-interaction=nonstopmode", "resume.tex"]
            
            logger.info("Running xelatex compilation (Pass 1)...")
            subprocess.run(cmd, cwd=temp_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            logger.info("Running xelatex compilation (Pass 2)...")
            result = subprocess.run(cmd, cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            
            pdf_path = os.path.join(temp_dir, "resume.pdf")
            
            # DEBUG: Save tex file for inspection
            import shutil
            shutil.copy2(tex_file_path, "debug_resume.tex")
            if os.path.exists(os.path.join(temp_dir, "resume.log")):
                shutil.copy2(os.path.join(temp_dir, "resume.log"), "debug_resume.log")
            
            if os.path.exists(pdf_path):
                import shutil
                shutil.copy2(pdf_path, output_path)
                logger.info(f"LaTeX PDF generated successfully at {output_path}")
                return True
            else:
                logger.error("xelatex failed to produce a PDF.")
                logger.error(result.stdout.decode('utf-8', errors='ignore'))
                return False

    except Exception as e:
        logger.error(f"Error during LaTeX PDF generation: {e}")
        return False
