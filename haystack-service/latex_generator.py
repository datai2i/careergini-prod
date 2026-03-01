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


def generate_pdf_latex(
    output_path: str,
    persona: dict,
    template: str = "professional",
    page_count: int = 2,
    template_dir: str = "latex_templates"
) -> bool:
    """
    Generate a PDF resume using LaTeX via Jinja2 templating.
    """
    if template not in ["professional", "executive", "fresher"]:
        template = "professional"

    compact = (page_count == 1)

    template_file = f"{template}.tex.j2"
    template_path = os.path.join(template_dir, template_file)
    
    if not os.path.exists(template_path):
        logger.error(f"LaTeX template not found: {template_path}")
        return False

    env = setup_jinja_env(template_dir)
    
    try:
        jinja_template = env.get_template(template_file)
        # Flatten persona to match reportlab format expectations structurally
        data = dict(persona)
        if "tailored_summary" in data:
            data["summary"] = data["tailored_summary"]
        if "tailored_skills" in data:
            data["top_skills"] = data["tailored_skills"]
        if "tailored_experience" in data:
            data["experience_highlights"] = data["tailored_experience"]
            
        data['compact'] = compact
        
        # Enforce compact mode bullets/skills filtering safely in python layer
        if compact:
            exps = data.get("experience_highlights", [])
            trimmed = []
            for exp in exps:
                exp_copy = dict(exp)
                raw_bl = exp_copy.get("tailored_bullets") or exp_copy.get("key_achievement") or []
                if isinstance(raw_bl, str):
                     # fallback split
                     bl = [b.strip() for b in raw_bl.replace(";", "\n").split("\n") if b.strip()]
                else:
                    bl = [str(b).strip() for b in raw_bl if str(b).strip()]
                exp_copy["tailored_bullets"] = bl[:2]
                trimmed.append(exp_copy)
            data["experience_highlights"] = trimmed
            
            if data.get("top_skills"):
                data["top_skills"] = data["top_skills"][:8]
                
            if template == "fresher" and data.get("projects"):
                data["projects"] = data["projects"][:2]

        tex_content = jinja_template.render(**data)
        
        # Create a temporary directory for compilation
        with tempfile.TemporaryDirectory() as temp_dir:
            tex_file_path = os.path.join(temp_dir, "resume.tex")
            with open(tex_file_path, "w", encoding="utf-8") as f:
                f.write(tex_content)
                
            # Compile with xelatex
            # We run it twice to resolve references/layout properly
            cmd = ["xelatex", "-interaction=nonstopmode", "resume.tex"]
            
            logger.info("Running xelatex compilation (Pass 1)...")
            subprocess.run(cmd, cwd=temp_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            logger.info("Running xelatex compilation (Pass 2)...")
            result = subprocess.run(cmd, cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            
            pdf_path = os.path.join(temp_dir, "resume.pdf")
            if os.path.exists(pdf_path):
                # Copy to output path
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
