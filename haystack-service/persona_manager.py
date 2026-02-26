
import json
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class PersonaManager:
    """
    Manages the User's "Golden Record" - a unified profile aggregated from:
    1. Resume Parsing (High trust for history/skills)
    2. LinkedIn Scraping (High trust for current role)
    3. Chat Interactions (High trust for goals/preferences)
    """
    
    def __init__(self, user_id: str, base_dir: Optional[str] = None):
        self.user_id = user_id
        self.base_dir = base_dir or f"uploads/{user_id}"
        self.profile_path = f"{self.base_dir}/unified_profile.json"
        
        # Ensure directory exists
        os.makedirs(self.base_dir, exist_ok=True)
        
        # Load or initialize profile
        self.profile = self._load_profile()

    def _load_profile(self) -> Dict[str, Any]:
        """Load profile from disk or create empty one"""
        if os.path.exists(self.profile_path):
            try:
                with open(self.profile_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading profile for {self.user_id}: {e}")
        
        # Default empty schema
        return {
            "identity": {
                "full_name": "",
                "professional_title": "",
                "summary": "",
                "email": "",
                "phone": "",
                "location": "",
                "linkedin": "",
                "portfolio_url": ""
            },
            "skills": [],
            "experience": [],
            "projects": [],
            "education": [],
            "goals": [],
            "job_preferences": {
                "target_roles": [],
                "target_locations": [],
                "remote_preference": "hybrid",
                "min_salary": 0
            },
            "meta": {
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "sources": []
            }
        }

    def save(self):
        """Persist profile to disk"""
        self.profile["meta"]["updated_at"] = datetime.now().isoformat()
        try:
            with open(self.profile_path, "w") as f:
                json.dump(self.profile, f, indent=2)
            logger.info(f"Saved unified profile for {self.user_id}")
        except Exception as e:
            logger.error(f"Error saving profile: {e}")

    def ingest_resume_data(self, resume_data: Dict[str, Any]):
        """Merge data from parsed resume"""
        logger.info(f"[PersonaManager] Merging resume data into persona for {self.user_id}")
        logger.info(f"[PersonaManager] Incoming full_name: {resume_data.get('full_name') or resume_data.get('name')}")
        
        # Update Identity if empty or from resume (resume usually authoritative for basic info)
        if hasattr(resume_data, "get"):
             full_name = resume_data.get("full_name") or resume_data.get("name")
             if full_name: 
                 logger.info(f"[PersonaManager] Updating name from '{self.profile['identity']['full_name']}' to '{full_name}'")
                 self.profile["identity"]["full_name"] = full_name
             
             title = resume_data.get("professional_title") or resume_data.get("title")
             if title: self.profile["identity"]["professional_title"] = title
             
             email = resume_data.get("email")
             if email: self.profile["identity"]["email"] = email
             
             phone = resume_data.get("phone")
             if phone: self.profile["identity"]["phone"] = phone
             
             location = resume_data.get("location")
             if location: self.profile["identity"]["location"] = location

             linkedin = resume_data.get("linkedin")
             if linkedin: self.profile["identity"]["linkedin"] = linkedin

             portfolio_url = resume_data.get("portfolio_url")
             if portfolio_url: self.profile["identity"]["portfolio_url"] = portfolio_url

             summary = resume_data.get("summary")
             if summary: self.profile["identity"]["summary"] = summary

             # Replace Skills (Resume/Manual confirmation is the new source of truth)
             new_skills = resume_data.get("top_skills") or resume_data.get("skills") or []
             if new_skills:
                 self.profile["skills"] = list(new_skills)
                 logger.info(f"[PersonaManager] Updated skills: {len(self.profile['skills'])} items")

             # Replace Experience (Resume usually has the best structured experience)
             experience = resume_data.get("experience_highlights") or resume_data.get("experience")
             if experience:
                 self.profile["experience"] = experience
                 logger.info(f"[PersonaManager] Updated experience: {len(self.profile['experience'])} items")

             # Replace Education
             education = resume_data.get("education")
             if education:
                 self.profile["education"] = education

             # Replace Projects
             projects = resume_data.get("projects")
             if projects:
                 self.profile["projects"] = projects

             self._add_source("resume")
             self.save()

    def update_from_chat(self, intent: str, data: Dict[str, Any]):
        """
        Update specific fields based on chat interaction.
        intent: 'update_goals', 'update_skills', 'update_preferences'
        """
        if intent == "update_goals":
            new_goals = data.get("goals", [])
            current_goals = set(self.profile["goals"])
            current_goals.update(new_goals)
            self.profile["goals"] = list(current_goals)
            
        elif intent == "update_skills":
            new_skills = data.get("skills", [])
            current_skills = set(self.profile["skills"])
            current_skills.update(new_skills)
            self.profile["skills"] = list(current_skills)
            
        elif intent == "update_preferences":
            # Deep merge preferences
            for k, v in data.items():
                if k in self.profile["job_preferences"]:
                    self.profile["job_preferences"][k] = v
                    
        self._add_source("chat")
        self.save()

    def get_context_for_llm(self) -> str:
        """Generate a rich context string for LLM, merging unified profile and resume persona."""
        p = self.profile
        identity = p["identity"]

        # Also try to read from persona.json (resume upload) as a richer fallback
        persona_path = f"{self.base_dir}/persona.json"
        resume_persona = {}
        if os.path.exists(persona_path):
            try:
                with open(persona_path, "r") as f:
                    resume_persona = json.load(f)
            except Exception:
                pass

        # Merge fields - prefer unified profile but fall back to resume persona
        full_name = identity.get("full_name") or resume_persona.get("full_name") or resume_persona.get("name") or "User"
        title = identity.get("professional_title") or resume_persona.get("professional_title") or resume_persona.get("title") or "Professional"
        location = identity.get("location") or resume_persona.get("location") or "Unknown"
        summary = identity.get("summary") or resume_persona.get("summary") or ""
        skills = p["skills"] or resume_persona.get("top_skills") or resume_persona.get("skills") or []
        goals = p["goals"]
        experience = p.get("experience") or resume_persona.get("experience_highlights") or resume_persona.get("experience") or []
        education = p.get("education") or resume_persona.get("education") or []

        context = f"USER PROFILE:\nName: {full_name}\nTitle: {title}\nLocation: {location}\n"
        if summary:
            context += f"Summary: {summary[:300]}\n"
        if skills:
            context += f"Top Skills: {', '.join(list(skills)[:20])}\n"
        if goals:
            context += f"Career Goals: {', '.join(goals)}\n"

        exp_lines = []
        for exp in experience[:4]:
            if isinstance(exp, dict):
                role = exp.get("role") or exp.get("title", "")
                company = exp.get("company", "")
                duration = exp.get("duration", "")
                achievement = exp.get("key_achievement") or exp.get("description", "")
                exp_lines.append(f"  - {role} at {company} ({duration}): {str(achievement)[:120]}")
        if exp_lines:
            context += "Work Experience:\n" + "\n".join(exp_lines) + "\n"

        edu_lines = []
        for edu in education[:2]:
            if isinstance(edu, dict):
                edu_lines.append(f"  - {edu.get('degree', '')} from {edu.get('school', '')} ({edu.get('year', '')})")
        if edu_lines:
            context += "Education:\n" + "\n".join(edu_lines) + "\n"

        prefs = p.get("job_preferences", {})
        if prefs.get("target_roles"):
            context += f"Target Roles: {', '.join(prefs['target_roles'])}\n"

        return context.strip()


    def _add_source(self, source_name: str):
        if source_name not in self.profile["meta"]["sources"]:
            self.profile["meta"]["sources"].append(source_name)
