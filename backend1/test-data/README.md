# Test CV — Full Profile Extraction

## File
`Sample_Full_Profile_CV.pdf`

Synthetic resume for **ARJUN VIKRAM MEHTA** covering all profile sections:
personal details, summary, work experience, internship, education (3 levels), projects, skills, languages (English/Hindi/Marathi), certifications, academic achievements, GATE exam, accomplishments, career preferences, and a career gap.

## How to test
1. Open the candidate portal (localhost:3000) and go to profile / resume upload.
2. Upload `Sample_Full_Profile_CV.pdf`.
3. After upload, check:
   - Profile fields auto-filled
   - API response `profileExtractPdfUrl` (extracted data PDF)
   - Backend terminal logs for section counts

## Regenerate
```bash
node scripts/generate-test-cv.js
```
