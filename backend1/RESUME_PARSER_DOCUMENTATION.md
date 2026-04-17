# Resume Parser System - Complete Documentation

## Overview

The Resume Parser System uses **Gemini AI** to extract structured candidate information from uploaded CV files. It follows a complete pipeline from file upload to database storage.

## Pipeline Architecture

```
Resume Upload
    ↓
File Processing Layer (detect file type)
    ↓
Text Extraction (PDF/DOCX/Image OCR)
    ↓
Text Cleaning (remove noise, normalize)
    ↓
AI Resume Parser (Gemini AI)
    ↓
Data Validation
    ↓
Return Structured Candidate Data
```

## Supported File Formats

- **PDF** - `.pdf` files
- **DOCX** - `.docx` files  
- **Images** - `.jpg`, `.jpeg`, `.png` (uses Gemini Vision for OCR)

## Implementation Details

### STEP 1: File Processing

**Function:** `parseResume(filePath)` or `parseResumeFromBuffer(buffer, mimeType, fileName)`

- Detects file type from extension
- Routes to appropriate extraction method
- Handles PDF, DOCX, and Image files

### STEP 2: Text Extraction

**Function:** `extractText(buffer, mimeType, fileType)`

- **PDF**: Uses `pdf-parse` library
- **DOCX**: Uses `mammoth` library
- **Images**: Passes directly to Gemini Vision (no pre-extraction)

### STEP 3: Text Cleaning

**Function:** `cleanText(text)`

Removes:
- Bullet characters (•, ·, ▪, etc.)
- Page numbers
- Extra spaces
- Repeated line breaks
- Leading/trailing whitespace

Normalizes:
- Merges broken lines
- Standardizes spacing

### STEP 4: AI Resume Parser

**Function:** `parseWithAI(text, imageBuffer, imageMimeType)`

Uses **Gemini 1.5 Pro** model with:
- Text-based parsing for PDF/DOCX
- Vision-based OCR for images

**AI Prompt Structure:**
- Strict JSON-only response requirement
- Comprehensive extraction rules
- Field normalization instructions
- Date format conversion rules

### STEP 5: Data Validation

**Function:** `validateData(data)`

Validates:
- Email format (regex)
- Phone number format
- Date formats
- LinkedIn URL format
- Education years (1950 - current year + 1)
- Removes invalid values

### STEP 6: Return Structured Data

Returns JSON in this format:

```json
{
  "personalInformation": {
    "fullName": "",
    "email": "",
    "phoneNumber": "",
    "alternatePhoneNumber": "",
    "gender": "",
    "dateOfBirth": "",
    "maritalStatus": "",
    "address": "",
    "city": "",
    "country": "",
    "nationality": "",
    "passportNumber": "",
    "linkedinProfile": ""
  },
  "education": [
    {
      "degree": "",
      "institution": "",
      "specialization": "",
      "startYear": 2020,
      "endYear": 2024
    }
  ],
  "skills": [
    {
      "languageName": "",
      "proficiency": "BEGINNER|INTERMEDIATE|ADVANCED|NATIVE",
      "speak": true,
      "read": true,
      "write": true
    }
  ],
  "workExperience": [
    {
      "jobTitle": "",
      "company": "",
      "workLocation": "",
      "startDate": "2022-01-01",
      "endDate": "2024-01-01",
      "currentlyWorking": false,
      "responsibilities": ""
    }
  ]
}
```

## Environment Setup

Add to `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Installation

```bash
cd backend
npm install
```

Required packages:
- `@google/generative-ai` - Gemini AI SDK
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction
- `multer` - File upload handling

## API Usage

### Endpoint

```
POST /api/cv/upload
Content-Type: multipart/form-data
```

### Request

- `cv`: File (PDF, DOCX, JPG, PNG - max 5MB)
- `candidateId`: String (Candidate ID)

### Response

```json
{
  "success": true,
  "message": "CV uploaded and processed successfully",
  "data": {
    "resumeId": "...",
    "fileName": "resume.pdf",
    "fileUrl": "/uploads/...",
    "latexFileUrl": "/uploads/...",
    "extractedData": {
      "hasPersonalInfo": true,
      "educationCount": 2,
      "workExperienceCount": 3,
      "skillsCount": 10,
      "languagesCount": 2
    }
  }
}
```

## Data Storage

The parsed data is automatically stored in:

1. **Resume** - File metadata
2. **CandidateProfile** - Personal information
3. **Education** - Education entries
4. **WorkExperience** - Work experience entries
5. **Skills** - Technical skills (creates if not exists)
6. **CandidateSkill** - Skill relationships
7. **CandidateLanguage** - Languages

## AI Extraction Rules

### Name Detection
- Detects name even if not explicitly labeled
- Usually from top of resume

### Email & Phone
- Extracts valid email addresses
- Extracts phone numbers with country codes

### Education
- Detects: B.Tech, B.Sc, BCA, MCA, MBA, PhD
- Normalizes degree names
- Extracts institution, specialization, years

### Experience
- Detects: Work Experience, Professional Experience, Employment History
- Extracts: role, company, dates, responsibilities
- Handles "Present" end dates
- Extracts technologies from descriptions

### Skills
- Extracts technical and soft skills
- Removes duplicates
- Normalizes skill names (ReactJS → React)

### Dates
- Converts: "Jan 2022" → "2022-01"
- Converts: "March 2023" → "2023-03"
- Returns null if missing

## Error Handling

The system handles:
- Invalid file types
- File size limits
- Missing candidate ID
- Gemini API errors
- Invalid JSON responses
- Data validation errors

## File Storage

- Original files: `backend/uploads/`
- LaTeX files: `backend/uploads/`
- Temp files: `backend/temp/` (auto-cleaned)

## Testing

Test with various formats:

```bash
# Test PDF
curl -X POST http://localhost:5000/api/cv/upload \
  -F "cv=@resume.pdf" \
  -F "candidateId=YOUR_CANDIDATE_ID"

# Test Image
curl -X POST http://localhost:5000/api/cv/upload \
  -F "cv=@resume.jpg" \
  -F "candidateId=YOUR_CANDIDATE_ID"
```

## Notes

- Gemini API key is required (set in `.env`)
- Images use Gemini Vision for OCR
- All data is validated before storage
- LaTeX conversion is included
- Database storage is automatic
