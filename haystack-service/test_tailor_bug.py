from agents.resume_advisor_agent import TailorResumeComponent

# The screenshot says: "Led the design... \nPartnered with... \nMentored... \nAnalyzed"
# This exactly matches the pattern of a single string containing literal '\n' characters.

llm_bullets = ["Led the design, development...\nPartnered with stakeholders...\nMentored junior team...\nAnalyzed data..."]
print("LLM generated a single bullet containing \n:", llm_bullets)

exp = {}
if isinstance(llm_bullets, list):
    exp["tailored_bullets"] = [str(b) for b in llm_bullets]
    
print("What gets saved into DB:", exp["tailored_bullets"])

