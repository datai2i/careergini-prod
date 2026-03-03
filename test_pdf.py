import sys
sys.path.append('/app')
import logging
logging.basicConfig(level=logging.INFO)

from pdf_generator import generate_pdf
persona = {'full_name': 'Test', 'summary': 'test summary'}
res = generate_pdf('test_out.pdf', persona, 'professional', None, 1)
with open('test_out.pdf', 'rb') as f:
    print(f'Test pdf size: {len(f.read())} bytes')
