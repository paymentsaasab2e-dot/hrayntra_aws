# AI-Assisted Field Matching Implementation

## Overview
This implementation provides an AI-assisted field matching system that automatically populates profile page modals with existing data from the database. The system uses semantic matching to map database fields to modal form fields, handling variations and field name differences.

## Architecture

### 1. Backend Components

#### Field Matching Service (`backend/src/services/field-matching.service.js`)
- **Purpose**: Maps database fields to modal fields using AI and rule-based matching
- **Features**:
  - AI-powered semantic matching using Google Gemini
  - Fallback to rule-based matching if AI is unavailable
  - Handles field name variations (e.g., `phoneNumber` ↔ `phone`, `fullName` → `firstName` + `lastName`)
  - Supports array-based sections (education, work experience, skills, etc.)
  - Transforms data types (dates, enums, etc.)

#### API Endpoint (`GET /api/cv/profile-all/:candidateId`)
- **Location**: `backend/src/controllers/cv.controller.js`
- **Function**: `getAllProfileData`
- **Returns**: 
  - `data`: AI-matched modal data
  - `rawData`: Original database data for reference

### 2. Frontend Components

#### Profile Page (`phasdenewwwww/src/app/profile/page.tsx`)
- **Auto-population**: Fetches matched data on component mount
- **State Management**: Updates modal state variables with matched data
- **Loading State**: Shows loading indicator while fetching data

## Field Matching Logic

### Matching Strategies

1. **AI Matching** (Primary)
   - Uses Google Gemini to semantically match fields
   - Handles complex variations and context
   - Returns JSON mapping of modal fields to database fields

2. **Rule-Based Matching** (Fallback)
   - Predefined field mappings
   - Normalized field name comparison
   - Partial matching for similar fields

### Field Mappings

#### Personal Information
- `fullName` → `firstName` + `lastName` (split)
- `phoneNumber` → `phone`
- `dateOfBirth` → `dob` (formatted)
- `employmentStatus` → `employment`
- `gender` (enum) → `gender` (string)

#### Education
- `degree` → `educationLevel` + `degreeProgram`
- `institution` → `institutionName`
- `specialization` → `fieldOfStudy`
- `startYear` → `startYear` (string)
- `endYear` → `endYear` (string)
- `isOngoing` → `currentlyStudying`

#### Work Experience
- `jobTitle` → `jobTitle`
- `company` → `companyName`
- `workLocation` → `workLocation`
- `startDate` → `startDate` (YYYY-MM-DD)
- `endDate` → `endDate` (YYYY-MM-DD)
- `isCurrentJob` → `currentlyWorkHere`
- `responsibilities` → `keyResponsibilities`

#### Skills
- `skill.name` → `name`
- `proficiency` (enum) → `proficiency` (string: Beginner/Intermediate/Advanced)
- `skill.category` → `category`

#### Languages
- `name` → `name`
- `proficiency` (enum) → `proficiency` (string)
- `canSpeak` → `speak`
- `canRead` → `read`
- `canWrite` → `write`

## Data Flow

```
1. User opens Profile Page
   ↓
2. Frontend calls GET /api/cv/profile-all/:candidateId
   ↓
3. Backend fetches all candidate data from database
   ↓
4. Field Matching Service processes data:
   - Loads modal field structure from PROFILE_MODALS_FIELDS.json
   - Matches database fields to modal fields (AI or rule-based)
   - Transforms data types and formats
   ↓
5. Backend returns matched data
   ↓
6. Frontend populates modal state variables
   ↓
7. When user opens a modal, it displays pre-filled data
```

## Usage

### Backend API

```javascript
GET /api/cv/profile-all/:candidateId

Response:
{
  "success": true,
  "data": {
    "basicInfo": { ... },
    "education": [ ... ],
    "workExperience": { ... },
    "skills": { ... },
    "languages": { ... },
    "resume": { ... },
    "careerPreferences": { ... }
  },
  "rawData": { ... }
}
```

### Frontend Integration

The profile page automatically fetches and populates data on mount:

```typescript
useEffect(() => {
  const candidateId = sessionStorage.getItem('candidateId');
  // Fetches data and populates modal states
  fetchProfileData();
}, []);
```

## Features

### ✅ Implemented
- [x] Backend endpoint to fetch all profile data
- [x] AI-assisted field matching service
- [x] Rule-based fallback matching
- [x] Semantic field name matching
- [x] Array-based section handling (education, work experience, skills, languages)
- [x] Data type transformations (dates, enums, strings)
- [x] Frontend auto-population on page load
- [x] Modal state management
- [x] Loading states

### 🔄 Dynamic Behavior
- System works dynamically - new fields in database or modals are automatically matched
- No hardcoded field mappings required (uses AI + rules)
- Handles missing fields gracefully

### 🛡️ Safety Features
- Modals only populate if `initialData` is provided
- User edits are preserved (modals use state, not direct DB writes)
- Empty fields remain empty if no match found
- Fallback to rule-based matching if AI fails

## Configuration

### Environment Variables
- `GEMINI_API_KEY`: Required for AI matching (optional - falls back to rules if not set)

### Modal Fields Structure
- Location: `PROFILE_MODALS_FIELDS.json`
- Contains all modal field definitions
- Used by matching service to understand modal structure

## Error Handling

- If candidate not found: Returns 404
- If AI matching fails: Falls back to rule-based matching
- If modal fields structure missing: Uses direct field matching
- If field type mismatch: Attempts type conversion

## Future Enhancements

1. **Caching**: Cache matched data to reduce API calls
2. **User Preferences**: Allow users to customize field mappings
3. **Validation**: Add validation for matched data
4. **Conflict Resolution**: Handle cases where multiple DB fields match one modal field
5. **Real-time Updates**: Update modals when database changes

## Testing

To test the implementation:

1. Ensure candidate has data in database
2. Open profile page (`/profile`)
3. Check browser console for loading logs
4. Open any modal - it should be pre-filled with matched data
5. Verify data accuracy and formatting

## Notes

- The system prioritizes AI matching but gracefully falls back to rules
- Array-based sections (education, work experience) are handled as arrays
- Date fields are formatted appropriately for display
- Enum values are converted to user-friendly strings
- The system is designed to be extensible - new modals/fields are automatically supported
