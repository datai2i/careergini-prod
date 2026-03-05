from latex_generator import generate_pdf_latex
import logging

logging.basicConfig(level=logging.INFO)

persona = {
    "full_name": "John Doe",
    "professional_title": "Developer",
    "summary": "This is a summary",
    "top_skills": ["Python", "JavaScript"],
    "experience_highlights": [
        {"role": "Dev", "company": "ABC", "duration": "2020", "tailored_bullets": ["Built X"]}
    ],
    "projects": [{"name": "P1", "description": "Built Y"}],
    "education": [{"degree": "BS", "school": "MIT", "year": "2020"}]
}

templates = ["jakes", "faangpath", "deedy", "professional", "executive", "fresher"]

for t in templates:
    try:
        print(f"\n================ Testing {t} ================")
        generate_pdf_latex(f"test_{t}.pdf", persona, template=t)
        print(f"{t} Success")
    except Exception as e:
        print(f"{t} Failed:", e)

