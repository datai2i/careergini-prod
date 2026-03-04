from agents.resume_advisor_agent import _sanitize_dict
import json

def test_sanitization():
    # Simulate the exact LLM failure condition
    mock_llm_json = {
        "tailored_summary": "A strong senior engineer.",
        "tailored_skills": ["React", "Angular", "Node.js"],
        "tailored_experience": [
            {
                "role": "Senior Software Engineer",
                "company": "IGT Solutions",
                "duration": "09/2023 - Present",
                "tailored_bullets": [
                    {
                        "action": "Migrated from Angular v14 to v19, improving performance.",
                        "result": "Project performance improved by 20%."
                    },
                    {
                        "action": "Collaborated with cross-functional teams.",
                        "result": "Project visibility increased by 30%."
                    },
                    "A normal string bullet point.",
                    {
                        "some_other_key": "This is a weird dict missing action/result"
                    }
                ]
            }
        ]
    }
    
    print("BEFORE SANITIZATION:")
    print(json.dumps(mock_llm_json, indent=2))
    
    clean_data = _sanitize_dict(mock_llm_json)
    
    print("\\n\\nAFTER SANITIZATION:")
    print(json.dumps(clean_data, indent=2))
    
    bullets = clean_data["tailored_experience"][0]["tailored_bullets"]
    
    assert isinstance(bullets[0], str), "Bullet 1 is not a string!"
    assert "Migrated from Angular v14 to v19" in bullets[0], "Bullet 1 content missing!"
    
    assert isinstance(bullets[2], str), "Bullet 3 is not a string!"
    assert bullets[2] == "A normal string bullet point.", "Bullet 3 altered!"
    
    assert isinstance(bullets[3], str), "Bullet 4 is not a string!"
    assert "This is a weird dict" in bullets[3], "Bullet 4 fallback failed!"
    
    print("\\nSUCCESS: `_sanitize_dict` beautifully neutralized the anomalous dictionaries into clean strings!")

if __name__ == "__main__":
    test_sanitization()
