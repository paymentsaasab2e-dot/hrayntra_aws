from fpdf import FPDF
from pathlib import Path

out_dir = Path(__file__).resolve().parent

content = """JOB POSTING - TEST FILE

Role: Senior React Developer
Openings: 3
Company: BluePeak Solutions
Location: Bangalore, India (Hybrid)
Experience: 4 to 7 years
Salary: 18-28 LPA

Skills: React, TypeScript, Next.js, Redux, REST APIs, Jest

Responsibilities:
- Build frontend features for web applications
- Optimize performance and page load times
- Collaborate with backend engineers on APIs
- Participate in code reviews and mentor junior developers

Requirements:
- B.E/B.Tech preferred
- Strong JavaScript and TypeScript fundamentals
- 4+ years experience with React ecosystem

Benefits:
- Health insurance
- Flexible working hours
- Remote work days

About the role:
BluePeak Solutions is hiring a Senior React Developer to join our product engineering team in Bangalore."""

pdf = FPDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()
pdf.set_font("Helvetica", size=11)

for line in content.split("\n"):
    text = line.encode("latin-1", "replace").decode("latin-1")
    if not text.strip():
        pdf.ln(4)
        continue
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(pdf.epw, 6, text)

pdf_path = out_dir / "Senior-React-Developer-Job-Test.pdf"
pdf.output(str(pdf_path))

txt_path = out_dir / "Senior-React-Developer-Job-Test.txt"
txt_path.write_text(content, encoding="utf-8")

print(f"Created: {pdf_path}")
print(f"Created: {txt_path}")
