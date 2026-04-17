# Profile Page Database Integration

## Overview
The profile page modals now store and fetch candidate information directly from the database without using any AI. All field mapping is handled using normal backend logic.

## Backend APIs

### Get All Profile Data
**GET** `/api/profile/:candidateId`

Fetches all profile data for a candidate including:
- Personal Information
- Education
- Work Experience
- Skills
- Languages
- Career Preferences
- Resume

**Response:**
```json
{
  "success": true,
  "data": {
    "personalInfo": { ... },
    "education": [ ... ],
    "workExperience": [ ... ],
    "skills": [ ... ],
    "languages": [ ... ],
    "careerPreferences": { ... },
    "resume": { ... }
  }
}
```

### Personal Information
**PUT** `/api/profile/personal-info/:candidateId`

Updates personal information (firstName, lastName, email, phone, etc.)

### Education
**POST** `/api/profile/education/:candidateId` - Create new education
**PUT** `/api/profile/education/:educationId` - Update existing education
**DELETE** `/api/profile/education/:educationId` - Delete education

### Work Experience
**POST** `/api/profile/work-experience/:candidateId` - Create new work experience
**PUT** `/api/profile/work-experience/:experienceId` - Update existing work experience
**DELETE** `/api/profile/work-experience/:experienceId` - Delete work experience

### Skills
**POST** `/api/profile/skills/:candidateId`

Saves all skills (replaces existing skills)

### Languages
**POST** `/api/profile/languages/:candidateId`

Saves all languages (replaces existing languages)

### Career Preferences
**PUT** `/api/profile/career-preferences/:candidateId`

Updates career preferences

## Frontend Implementation

### Data Fetching
When the profile page loads:
1. Frontend calls `GET /api/profile/:candidateId`
2. Backend fetches data from database
3. Frontend populates all modal states with fetched data

### Data Saving
When user submits a modal:
1. Frontend captures form data
2. Sends POST/PUT request to appropriate backend API
3. Backend stores/updates data in database
4. Frontend refreshes data from backend
5. Modal closes with updated data

### CRUD Operations

#### Create (Add New)
- User clicks "Add" button
- Modal opens with empty fields
- User fills form and saves
- Frontend sends POST request
- New record created in database

#### Read (View)
- Profile page loads
- All modals populated with database data
- User can view existing data

#### Update (Edit)
- User clicks "Edit" on existing entry
- Modal opens with pre-filled data
- User modifies and saves
- Frontend sends PUT request
- Record updated in database

#### Delete (Remove)
- User clicks delete button
- Frontend sends DELETE request
- Record removed from database
- UI refreshes to show updated list

## Field Mapping

### Personal Information
- `firstName` + `middleName` + `lastName` → `fullName` (database)
- `phone` → `phoneNumber` (database)
- `dob` (formatted string) → `dateOfBirth` (DateTime)
- `gender` (string) → `gender` (enum: MALE/FEMALE/OTHER)
- `employment` (string) → `employmentStatus` (enum)

### Education
- `educationLevel` / `degreeProgram` → `degree`
- `institutionName` → `institution`
- `fieldOfStudy` → `specialization`
- `startYear` / `endYear` (string) → `startYear` / `endYear` (Int)
- `currentlyStudying` → `isOngoing`

### Work Experience
- `jobTitle` → `jobTitle`
- `companyName` → `company`
- `workLocation` → `workLocation`
- `startDate` / `endDate` (YYYY-MM-DD) → `startDate` / `endDate` (DateTime)
- `currentlyWorkHere` → `isCurrentJob`
- `keyResponsibilities` → `responsibilities`

### Skills
- `name` → `skill.name`
- `proficiency` (Beginner/Intermediate/Advanced) → `proficiency` (enum)
- `category` → `skill.category`

### Languages
- `name` → `name`
- `proficiency` (string) → `proficiency` (enum)
- `speak` / `read` / `write` → `canSpeak` / `canRead` / `canWrite`

## Database Tables Used

1. **candidate_profiles** - Personal information
2. **educations** - Education entries
3. **work_experiences** - Work experience entries
4. **skills** - Skill master table
5. **candidate_skills** - Candidate-skill relationships
6. **candidate_languages** - Languages
7. **career_preferences** - Career preferences
8. **resumes** - Resume files

## Features

✅ **No AI Required** - All field mapping done with backend logic
✅ **Direct Database Access** - Data stored and retrieved directly
✅ **Full CRUD Support** - Create, Read, Update, Delete operations
✅ **Array Handling** - Properly handles education, work experience arrays
✅ **Auto-refresh** - Data refreshes after save operations
✅ **Error Handling** - Proper error messages for failed operations
✅ **Type Conversion** - Handles string to enum, date formatting, etc.

## Usage Flow

1. **Page Load**
   - User opens profile page
   - Frontend fetches all data from `/api/profile/:candidateId`
   - All modals populated with database data

2. **Add New Entry**
   - User clicks "Add" button
   - Modal opens empty
   - User fills form and saves
   - POST request sent to backend
   - Data saved to database
   - Page refreshes to show new entry

3. **Edit Existing Entry**
   - User clicks "Edit" on existing entry
   - Modal opens with pre-filled data
   - User modifies and saves
   - PUT request sent to backend
   - Data updated in database
   - Page refreshes to show updated entry

4. **Delete Entry**
   - User clicks delete button
   - DELETE request sent to backend
   - Record removed from database
   - Page refreshes to show updated list

## Error Handling

- All API calls include try-catch blocks
- User-friendly error messages displayed
- Failed operations don't break the UI
- Data validation on backend

## Notes

- All data operations are synchronous with database
- No AI or LLM used for field matching
- Field mapping uses simple backend logic
- Supports multiple entries for education and work experience
- Skills and languages are replaced entirely on save (not merged)
