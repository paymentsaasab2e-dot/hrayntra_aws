# CV Parser System - No API Key Required

## Overview

The CV upload system now uses a **custom parser** that extracts data from CVs without requiring any external API keys. The system uses pattern matching, regex, and text analysis to extract structured data.

## Features

- ✅ **No API Keys Required** - Completely free, no external dependencies
- ✅ **PDF & DOCX Support** - Extracts text from PDF and DOCX files
- ✅ **Intelligent Parsing** - Uses pattern matching and regex to extract data
- ✅ **LaTeX Conversion** - Converts extracted data to LaTeX format
- ✅ **Database Storage** - Stores all extracted data in database

## What Gets Extracted

### 1. Personal Information
- Full Name (from first line or "Name:" pattern)
- Email (regex pattern matching)
- Phone Number (various formats supported)
- Address (from address patterns)
- City & Country (parsed from address)
- LinkedIn URL (regex pattern matching)

### 2. Education
- Degree (Bachelor, Master, PhD, etc.)
- Institution (University, College, Institute)
- Specialization/Major
- Start Year & End Year
- Grade/GPA
- Description

### 3. Work Experience
- Job Title (from common job title patterns)
- Company Name
- Work Location
- Work Mode (Remote/On-site/Hybrid)
- Start Date & End Date
- Responsibilities (bullet points or paragraphs)
- Industry

### 4. Skills
- Skill Names (from skills section or common skills list)
- Category (auto-categorized: Programming, Frameworks, Databases, etc.)
- Proficiency Level
- Years of Experience

### 5. Languages
- Language Names (English, Spanish, French, etc.)
- Proficiency Level (Native, Advanced, Intermediate, Beginner)
- Can Speak/Read/Write

### 6. Summary/Objective
- Professional summary or objective statement

## How It Works

1. **Text Extraction**
   - PDF: Uses `pdf-parse` library
   - DOCX: Uses `mammoth` library

2. **Pattern Matching**
   - Email: Regex pattern for email addresses
   - Phone: Regex pattern for phone numbers
   - Dates: Multiple date format patterns
   - Sections: Keyword-based section detection

3. **Data Extraction**
   - Education: Looks for degree patterns, institutions, years
   - Work Experience: Identifies job titles, companies, dates
   - Skills: Extracts from skills section or common skills list
   - Languages: Matches common language names

4. **Data Storage**
   - All extracted data is stored in database
   - LaTeX file is generated and saved

## Parsing Logic

### Name Extraction
- Looks for "Name:" label
- Uses first substantial line if no label found
- Validates name format (capital letters, no special chars)

### Education Extraction
- Finds education section by keywords
- Extracts degree types (Bachelor, Master, etc.)
- Extracts institutions (University, College, etc.)
- Parses years (YYYY format or date ranges)

### Work Experience Extraction
- Finds experience section by keywords
- Identifies job titles (Engineer, Developer, Manager, etc.)
- Extracts company names
- Parses dates (various formats: "Jan 2020", "01/2020", "2020")
- Extracts responsibilities (bullet points or paragraphs)

### Skills Extraction
- Looks for skills section
- Falls back to common skills list if no section found
- Auto-categorizes skills (Programming, Frameworks, Databases, etc.)

## Installation

No additional setup required! Just install dependencies:

```bash
cd backend
npm install
```

## API Usage

Same as before - no changes needed:

```bash
POST /api/cv/upload
Content-Type: multipart/form-data

Form Data:
- cv: File (PDF/DOC/DOCX)
- candidateId: String
```

## Advantages

1. **No API Costs** - Completely free
2. **No Rate Limits** - Process unlimited CVs
3. **Privacy** - Data never leaves your server
4. **Fast** - No external API calls
5. **Reliable** - No dependency on external services

## Limitations

- May not be as accurate as AI-based extraction
- Requires well-formatted CVs for best results
- Some complex formats may need manual review

## Improving Accuracy

The parser can be improved by:
- Adding more pattern variations
- Expanding common skills list
- Adding more date format patterns
- Improving section detection logic

## Testing

Test with various CV formats to ensure accuracy:
- PDF resumes
- DOCX resumes
- Different date formats
- Various section structures
