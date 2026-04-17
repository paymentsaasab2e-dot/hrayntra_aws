# CV Upload with Gemini AI - Setup Guide

## Overview

The CV upload feature extracts all data from uploaded CVs using Google's Gemini AI, converts it to LaTeX format, and stores it in the database.

## Features

- ✅ Upload CV files (PDF, DOC, DOCX)
- ✅ Extract text from CV files
- ✅ Use Gemini AI to extract structured data
- ✅ Convert extracted data to LaTeX format
- ✅ Store data in database (Profile, Education, Work Experience, Skills, Languages)
- ✅ Automatic data mapping and storage

## Environment Variables

Add the following to your `.env` file:

```env
# Gemini AI API Key
GEMINI_API_KEY=AIzaSyDVFS-iE6REwkIFHEZuoVGPWIikNjy64BQ
```

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

Required packages:
- `@google/generative-ai` - Gemini AI SDK
- `multer` - File upload handling
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction

## API Endpoint

### POST `/api/cv/upload`

Upload and process a CV file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `cv`: File (PDF, DOC, or DOCX, max 5MB)
  - `candidateId`: String (Candidate ID from session)

**Response:**
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

## Data Extraction

The system extracts:

1. **Personal Information**
   - Full Name
   - Email
   - Phone Number
   - Address, City, Country
   - LinkedIn URL
   - Date of Birth
   - Gender
   - Nationality

2. **Education**
   - Degree
   - Institution
   - Specialization
   - Start/End Year
   - Grade
   - Description

3. **Work Experience**
   - Job Title
   - Company
   - Location
   - Work Mode (Remote/On-site/Hybrid)
   - Start/End Date
   - Responsibilities
   - Industry

4. **Skills**
   - Skill Name
   - Category
   - Proficiency Level
   - Years of Experience

5. **Languages**
   - Language Name
   - Proficiency
   - Can Speak/Read/Write

6. **Certifications**
   - Name
   - Issuer
   - Date

## LaTeX Conversion

All extracted data is automatically converted to LaTeX format and saved as a `.tex` file. The LaTeX file includes:

- Personal information section
- Summary
- Education entries
- Work experience entries
- Skills (grouped by category)
- Languages
- Certifications

## Database Storage

The extracted data is stored in:

- `resumes` - CV file metadata
- `candidate_profiles` - Personal information
- `educations` - Education entries
- `work_experiences` - Work experience entries
- `skills` - Skills (if not exists, creates new)
- `candidate_skills` - Candidate-skill relationships
- `candidate_languages` - Languages

## File Storage

Uploaded files are stored in:
- `backend/uploads/` directory
- Files are named: `{candidateId}_{timestamp}_{originalName}`
- LaTeX files are named: `{candidateId}_{timestamp}_cv.tex`

## Frontend Integration

The frontend page at `/uploadcv`:
- Gets candidate ID from sessionStorage
- Allows file selection (PDF, DOC, DOCX)
- Validates file type and size
- Shows upload progress
- Displays success/error messages
- Redirects to dashboard after successful upload

## Testing

1. Start the backend:
```bash
npm run dev
```

2. Test the upload endpoint:
```bash
curl -X POST http://localhost:5000/api/cv/upload \
  -F "cv=@/path/to/resume.pdf" \
  -F "candidateId=YOUR_CANDIDATE_ID"
```

## Error Handling

The system handles:
- Invalid file types
- File size limits (5MB)
- Missing candidate ID
- Gemini API errors
- Database errors
- File extraction errors

## Notes

- Gemini API key is hardcoded in the service (can be moved to .env)
- Files are stored locally (consider cloud storage for production)
- LaTeX conversion preserves all formatting
- All data is stored accurately in the database for future use
