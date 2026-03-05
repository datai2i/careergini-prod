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

print(generate_pdf_latex("test_out.pdf", persona, template="deedy"))
