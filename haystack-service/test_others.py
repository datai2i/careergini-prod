import logging
logging.basicConfig(level=logging.INFO)
from latex_generator import generate_pdf_latex

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

try:
    print("Testing faangpath...")
    generate_pdf_latex("test_faangpath.pdf", persona, template="faangpath")
except Exception as e:
    print("faangpath failed:", e)

try:
    print("Testing jakes...")
    generate_pdf_latex("test_jakes.pdf", persona, template="jakes")
except Exception as e:
    print("jakes failed:", e)

