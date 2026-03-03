with open("/home/ubuntu/careergini-prod-live/haystack-service/pdf_generator.py", "r") as f:
    text = f.read()

# Find the doc.build line and insert a print statement before it
target = "doc.build(story)"
replacement = "import logging; logging.info(f'STORY LENGTH: {len(story)}');\n        doc.build(story)"
if "STORY LENGTH" not in text:
    text = text.replace(target, replacement)
    with open("/home/ubuntu/careergini-prod-live/haystack-service/pdf_generator.py", "w") as f:
        f.write(text)
    print("Patched pdf_generator.py")
else:
    print("Already patched")
