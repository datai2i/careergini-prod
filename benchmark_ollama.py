import time
import httpx
import json

base_url = "http://localhost:11435"
model = "qwen2.5:1.5b"

prompt = """Extract structured information from this resume. Output ONLY valid JSON.
Resume text:
John Doe
Software Engineer with 5 years experience at Tech Corp.
Expert in Python, React, and Cloud architectures.
Built a scalable microservices platform using AWS and Docker.
B.S. in Computer Science from MIT.

Required JSON structure (extract real info only):
{
  "full_name": "Full name",
  "professional_title": "Current role",
  "years_experience": 0,
  "email": "email",
  "phone": "phone",
  "location": "city, country",
  "summary": "2-3 sentence bio",
  "top_skills": ["Skill 1", "Skill 2"],
  "experience_highlights": [{"role":"Title","company":"Company","duration":"Dates","key_achievement":"One bullet"}],
  "education": [{"degree":"Degree","school":"School","year":"Year"}],
  "career_level": "Entry/Mid/Senior/Exec",
  "suggested_roles": ["Role 1", "Role 2"]
}"""

print(f"Benchmarking {model}...")
start_time = time.time()

with httpx.Client(timeout=120.0) as client:
    response = client.post(
        f"{base_url}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_thread": 4,
                "num_ctx": 2048,
                "temperature": 0.1
            }
        }
    )

end_time = time.time()
if response.status_code == 200:
    print(f"Success! Time taken: {end_time - start_time:.2f} seconds")
    print("Response snippet:", response.json().get("response", "")[:100])
else:
    print(f"Failed! Status code: {response.status_code}")
    print(response.text)
