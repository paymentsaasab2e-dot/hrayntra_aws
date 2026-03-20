# Frontend Codebase Analysis - Job Portal Application

## Executive Summary

This is a comprehensive job portal application built with **Next.js 16.0.10**, **React 19.2.1**, **TypeScript 5**, and **Tailwind CSS 4**. The application serves both candidates and recruiters, with a strong focus on AI-powered features for CV analysis, job matching, and skill suggestions.

---

## 1. Technology Stack

### Core Technologies
- **Framework**: Next.js 16.0.10 (App Router)
- **UI Library**: React 19.2.1
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Fonts**: Google Fonts (Geist, Geist_Mono, Arimo)

### Key Dependencies
- `next/image` - Optimized image handling
- `next/navigation` - Client-side routing (`useRouter`, `usePathname`)
- `next/font/google` - Font optimization
- Custom CSS modules and global styles

---

## 2. Project Structure

```
phasdenewwwww/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with fonts & metadata
│   │   ├── page.tsx            # Landing page
│   │   ├── globals.css         # Global styles & animations
│   │   ├── candidate-dashboard/
│   │   ├── profile/
│   │   ├── explore-jobs/
│   │   ├── applications/
│   │   ├── courses/
│   │   ├── uploadcv/
│   │   ├── aicveditor/
│   │   ├── cvscore/
│   │   ├── notification/
│   │   ├── whatsapp/
│   │   ├── extract/
│   │   ├── personal-details/
│   │   └── [various other pages]
│   ├── components/
│   │   ├── common/             # Shared components
│   │   │   ├── Header.tsx      # Navigation header
│   │   │   └── Footer.tsx      # Footer component
│   │   ├── layout/             # Layout components
│   │   │   └── DashboardContainer.tsx
│   │   ├── profile/            # Profile-related components
│   │   │   └── ProfileSectionCard.tsx
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── EditText.tsx
│   │   │   └── SearchView.tsx
│   │   └── modals/             # Modal components
│   │       ├── BasicInfoModal.tsx
│   │       ├── WorkExperienceModal.tsx
│   │       ├── EducationModal.tsx
│   │       ├── SkillsModal.tsx
│   │       ├── SummaryModal.tsx
│   │       ├── CareerPreferencesModal.tsx
│   │       ├── ResumeModal.tsx
│   │       ├── ApplicationSuccessModal.tsx
│   │       └── [other modals]
│   └── [other directories]
├── package.json
├── tsconfig.json
├── next.config.ts
└── [config files]
```

---

## 3. Core Configuration Files

### 3.1 `package.json`
- **Project Name**: `saasa_ph_1`
- **Version**: 0.1.0
- **Scripts**:
  - `dev`: Development server
  - `build`: Production build
  - `start`: Production server
  - `lint`: ESLint checking

### 3.2 `tsconfig.json`
- **Target**: ES2017
- **Module**: ESNext
- **JSX**: react-jsx
- **Path Aliases**: `@/*` → `./src/*`
- **Strict Mode**: Enabled

### 3.3 `next.config.ts`
- **Image Configuration**: Allows images from `images.unsplash.com`

### 3.4 `src/app/layout.tsx`
- **Root Layout**: Defines global HTML structure
- **Fonts Loaded**:
  - Geist Sans (variable: `--font-geist-sans`)
  - Geist Mono (variable: `--font-geist-mono`)
  - Arimo (variable: `--font-arimo`, weights: 400, 500, 600, 700)
- **Metadata**: Basic Next.js app metadata
- **Global CSS**: Imports `globals.css`

### 3.5 `src/app/globals.css`
- **Tailwind Import**: `@import "tailwindcss";`
- **CSS Variables**: Custom color scheme and design tokens
- **Animations**:
  - `slideDown`: Dropdown animations
  - `gradientShift`: Background gradient animations
  - `shimmer`: Loading shimmer effect
  - Notification animations (slide-in, fade-out)
- **Custom Scrollbar**: Styled scrollbars for webkit browsers

---

## 4. Key Pages & Routes

### 4.1 Landing Page (`/` - `src/app/page.tsx`)
**Purpose**: Entry point with role selection and value propositions

**Features**:
- **Role Selector**: Toggle between "Candidate" and "Recruiter" views
- **AI Value Propositions**: Dynamic content based on selected role
- **CV Maker Section**: Promotional section for CV creation
- **How It Works**: Step-by-step process explanation
- **State Management**: `useState` for role selection
- **Images**: Multiple `next/image` components for visual content

**Key Components**:
- Role-based conditional rendering
- Responsive design with Tailwind classes
- Interactive UI elements with hover states

---

### 4.2 Candidate Dashboard (`/candidate-dashboard` - `src/app/candidate-dashboard/page.tsx`)
**Purpose**: Main dashboard for job candidates

**Features**:
- **Profile Summary Card**: User information display
- **Application Status Pie Chart**: Visual representation of application statuses
  - Statuses: Applied, In Review, Interview, Offer, Rejected
- **Notifications Section**: Recent notifications with icons
- **Hiring Signals**: Job opportunities matching user profile
- **CV Score Display**: ATS compatibility score with progress indicator
- **Job Matches**: AI-recommended jobs with match percentages
- **Recommended Courses**: Skill development suggestions

**Data Structures**:
```typescript
interface ApplicationStatus {
  status: string;
  count: number;
  color: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}
```

**Visual Elements**:
- Pie chart SVG for application status
- Progress bars for CV score
- Card-based layout with hover effects
- Status badges with color coding

---

### 4.3 Profile Page (`/profile` - `src/app/profile/page.tsx`)
**Purpose**: Comprehensive user profile management

**Features**:
- **Profile Sections**:
  - Personal Details
  - Professional Summary
  - Work Experience
  - Education
  - Skills
  - Career Preferences
  - Resume/CV
  - Languages
  - Certifications
  - Projects
  - Portfolio Links
  - Accomplishments
  - Academic Achievements
  - Competitive Exams
  - Internships
  - Visa/Work Authorization
  - Vaccination Status

- **Section Management**:
  - Expandable/collapsible sections
  - Edit buttons for each section
  - Add new entries functionality
  - Status indicators (Complete/Incomplete)

- **Modal Integration**: Opens specific modals for editing each section

**State Management**:
- `useState` for modal visibility
- `useState` for profile data
- Session storage for persistence

**Helper Functions**:
- `getStatusColor()`: Returns color based on completion status
- `handleEditClick()`: Opens edit modal for specific section
- `handleAddClick()`: Opens add modal for new entries

---

### 4.4 Explore Jobs (`/explore-jobs` - `src/app/explore-jobs/page.tsx`)
**Purpose**: Job search and browsing interface

**Features**:
- **Search & Filters**:
  - Job title search
  - Location filter
  - Job type filter (Full-time, Part-time, Contract, etc.)
  - Salary range filter
  - Experience level filter
  - Industry filter

- **View Modes**:
  - Grid view (default)
  - List view (toggle)

- **Job Listings**:
  - Job cards with company logo, title, location, salary
  - Match percentage display
  - Quick apply button
  - Job description preview

- **Quick Screening Modal**: Pre-application screening questions

**Data Structure**:
```typescript
interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  match: number;
  logo: string;
  description: string;
  requirements: string[];
}
```

**Functions**:
- `renderJobCard()`: Grid view rendering
- `renderJobListItem()`: List view rendering
- Filter and search logic

---

### 4.5 Applications Page (`/applications` - `src/app/applications/page.tsx`)
**Purpose**: Track and manage job applications

**Features**:
- **Application List**: All submitted applications
- **Filters**:
  - Status filter (All, Applied, In Review, Interview, Offer, Rejected)
  - Date filter (All Time, This Week, This Month, Last 3 Months)
- **Search**: Search by job title or company
- **View Modes**: Grid and List views
- **Application Details**: Status, date applied, company info

**Data Structure**:
```typescript
interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
  appliedDate: string;
  match: number;
  logo: string;
}
```

**Status Colors**:
- Applied: Blue
- In Review: Yellow
- Interview: Purple
- Offer: Green
- Rejected: Red

---

### 4.6 Application Detail Page (`/applications/[id]` - `src/app/applications/[id]/page.tsx`)
**Purpose**: Detailed view of a specific application

**Features**:
- **Application Timeline**: Visual timeline of application events
- **Status Updates**: Real-time status changes
- **Communication Updates**: Email and WhatsApp notifications
- **Event Types**: Application submitted, viewed, shortlisted, interview scheduled, etc.

**Data Structures**:
```typescript
interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  icon: string;
}

interface CommunicationUpdate {
  id: string;
  type: 'email' | 'whatsapp';
  subject: string;
  message: string;
  timestamp: string;
  read: boolean;
}
```

---

### 4.7 Courses Page (`/courses` - `src/app/courses/page.tsx`)
**Purpose**: Browse and filter recommended courses

**Features**:
- **Course Listings**: Grid of course cards
- **Filters**:
  - Skill level (Beginner, Intermediate, Advanced)
  - Provider (Coursera, Udemy, edX, etc.)
  - Price (Free, Paid, All)
  - Duration (filter by hours)
  - Sort by (Relevance, Price, Duration, Rating)
- **AI Recommendations**: Highlighted AI-recommended courses
- **Course Details**: Title, provider, rating, duration, price, description

**Data Structure**:
```typescript
interface Course {
  id: string;
  title: string;
  provider: string;
  rating: number;
  duration: string;
  price: string;
  level: string;
  description: string;
  aiRecommended: boolean;
  image: string;
}
```

---

### 4.8 Upload CV Page (`/uploadcv` - `src/app/uploadcv/page.tsx`)
**Purpose**: CV upload interface

**Features**:
- **Two Upload Methods**:
  1. Upload from computer (drag & drop or file picker)
  2. Send via WhatsApp
- **File Format Support**: PDF, DOC, DOCX
- **File Size Limit**: 5MB
- **AI Analysis Note**: Information about AI-powered CV analysis

---

### 4.9 AI CV Editor (`/aicveditor` - `src/app/aicveditor/page.tsx`)
**Purpose**: AI-powered CV editing and optimization

**Features**:
- **CV Sections**:
  - Professional Summary
  - Work Experience
  - Education
  - Skills

- **AI Features**:
  - **Rewrite Suggestions**: AI-generated improvements for each section
  - **Keyword Optimization**: Suggests missing keywords
  - **Skill Suggestions**: AI-recommended skills to add
  - **Apply Rewrite**: One-click application of AI suggestions

- **Interactive Editing**:
  - Expandable/collapsible sections
  - Inline editing
  - Real-time preview

**State Management**:
- `summary`: Professional summary text
- `experiences`: Array of work experiences
- `educations`: Array of education entries
- `existingSkills`: Current skills list
- `aiSuggestedSkills`: AI-recommended skills
- `aiRewriteSuggestions`: AI improvement suggestions
- `keyword`: Keyword optimization suggestions

**Functions**:
- `toggleSection()`: Expand/collapse sections
- `applyRewrite()`: Apply AI suggestions

---

### 4.10 CV Score Page (`/cvscore` - `src/app/cvscore/page.tsx`)
**Purpose**: Display ATS compatibility score and recommendations

**Features**:
- **ATS Score**: Circular progress indicator (0-100%)
- **Key Strengths**: List of CV strengths
- **Areas for Improvement**: Suggestions for enhancement
- **Missing Keywords**: Keywords to add for better ATS matching
- **Formatting Suggestions**: Layout and structure recommendations
- **Action Button**: Navigate to AI CV Editor

**Visual Elements**:
- SVG circular progress chart
- Color-coded sections (green for strengths, yellow for improvements)
- Keyword tags with add functionality

---

### 4.11 Notification Page (`/notification` - `src/app/notification/page.tsx`)
**Purpose**: Centralized notification center

**Features**:
- **Notification Categories**:
  - Jobs
  - Applications
  - Interviews
  - Courses
  - System

- **Filters**: Filter by notification type
- **Mark as Read**: Individual and bulk actions
- **Notification Types**: Icons and colors per category
- **Time Display**: Relative time (e.g., "2 hours ago")

**Data Structure**:
```typescript
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}
```

---

### 4.12 WhatsApp Pages

#### 4.12.1 WhatsApp Login (`/whatsapp` - `src/app/whatsapp/page.tsx`)
**Purpose**: WhatsApp number entry for authentication

**Features**:
- **Country Code Dropdown**: Select country with flag icons
- **Phone Number Input**: WhatsApp number entry
- **Validation**: Phone number format validation
- **Navigation**: Routes to verification page

**State Management**:
- `selectedCountry`: Selected country code
- `whatsappNumberValue`: Phone number input
- `dropdownRef`: Click-outside detection for dropdown

#### 4.12.2 WhatsApp Verification (`/whatsapp/verify` - `src/app/whatsapp/verify/page.tsx`)
**Purpose**: OTP verification for WhatsApp

**Features**:
- **OTP Input**: 6-digit code input with floating label
- **Timer**: 29-second countdown before resend
- **Resend Code**: Resend OTP functionality
- **Phone Masking**: Displays masked phone number
- **Navigation**: Routes to upload CV page after verification

**State Management**:
- `otp`: OTP input value
- `timer`: Countdown timer
- `isResendDisabled`: Resend button state
- `isFocused`: Input focus state

---

### 4.13 Extract Page (`/extract` - `src/app/extract/page.tsx`)
**Purpose**: CV analysis progress screen

**Features**:
- **Loading Animation**: Spinning loader
- **Progress Bar**: Animated progress (0-100%)
- **Status Messages**: Dynamic status updates
  - "Extracting key skills..."
  - "Analyzing experience..."
  - "Processing education..."
- **Auto-Navigation**: Redirects to personal-details page on completion

**Implementation**:
- `useEffect` with intervals for progress simulation
- Status message rotation every 2 seconds
- Progress increment every 100ms

---

### 4.14 Personal Details Page (`/personal-details` - `src/app/personal-details/page.tsx`)
**Purpose**: Multi-step form for profile completion

**Features**:
- **Form Sections** (with slide animations):
  1. **Personal Information**:
     - Full name, email, phone
     - Date of birth, gender, nationality
     - Address, country, city
     - Marital status, passport number
     - LinkedIn profile
     - Profile photo upload
     - Alternate phone numbers

  2. **Education**:
     - Multiple education entries
     - Degree, institution, specialization
     - Start/end years
     - Add/remove education entries

  3. **Skills**:
     - Skill tags with add/remove
     - AI-suggested skills
     - Languages with proficiency levels
     - Language capabilities (speak, read, write)

  4. **Work Experience**:
     - Multiple work entries
     - Job title, company, dates
     - Responsibilities
     - Add/remove entries

  5. **Salary Expectation**:
     - Currency selection
     - Salary amount
     - Frequency (Annually, Monthly, Hourly)

- **Form Navigation**: Slide animations between sections
- **Floating Labels**: Input fields with animated labels
- **File Upload**: Profile photo with preview
- **Validation**: Form validation logic

**State Management**:
- Extensive `useState` hooks for each form field
- Focus states for floating labels
- Form section switching with animation direction tracking

---

## 5. Component Library

### 5.1 Common Components

#### 5.1.1 Header (`src/components/common/Header.tsx`)
**Purpose**: Global navigation header

**Features**:
- **Navigation Items**:
  - Dashboard
  - Explore Jobs
  - Applications
  - Courses
  - Profile
  - Notifications

- **Active Link Indicator**: Sliding underline animation
- **Notification Dropdown**: Notification list with unread count
- **Profile Dropdown**: User menu with logout option
- **Mobile Menu**: Hamburger menu for mobile devices
- **Logo**: SAASA B2E branding

**Implementation**:
- `useRouter` and `usePathname` for active link detection
- `useState` for dropdown/modal visibility
- `useEffect` for click-outside detection
- Session storage for notification state

**Navigation Indicator**:
- Dynamic width and position calculation
- Smooth CSS transitions
- Responsive positioning

---

#### 5.1.2 Footer (`src/components/common/Footer.tsx`)
**Purpose**: Global footer component

**Features**:
- Copyright information
- Navigation links (Privacy, Terms, Help)
- Responsive layout

---

### 5.2 Layout Components

#### 5.2.1 DashboardContainer (`src/components/layout/DashboardContainer.tsx`)
**Purpose**: Consistent container for dashboard pages

**Features**:
- Max-width constraint (`max-w-screen-2xl`)
- Responsive padding
- Overflow handling

---

### 5.3 UI Components

#### 5.3.1 Button (`src/components/ui/Button.tsx`)
**Purpose**: Reusable button component

**Props**:
- `text`: Button text
- `onClick`: Click handler
- `className`: Additional CSS classes
- `children`: React children (alternative to text)

---

#### 5.3.2 Dropdown (`src/components/ui/Dropdown.tsx`)
**Purpose**: Custom dropdown select component

**Features**:
- **Portal Rendering**: Menu rendered in portal for z-index control
- **Options**: Array of selectable options
- **Placeholder**: Default placeholder text
- **Click-Outside**: Closes on outside click
- **Keyboard Navigation**: Arrow keys support

**Props**:
- `options`: Array of `DropdownOption`
- `placeholder`: Placeholder text
- `onChange`: Selection change handler
- `value`: Selected value

---

#### 5.3.3 EditText (`src/components/ui/EditText.tsx`)
**Purpose**: Text input component

**Props**:
- `placeholder`: Input placeholder
- `value`: Input value
- `onChange`: Change handler
- `className`: Additional CSS classes

**Styling**:
- Focus ring with blue accent
- Placeholder color: `#9095A1`

---

#### 5.3.4 SearchView (`src/components/ui/SearchView.tsx`)
**Purpose**: Search input with icon

**Features**:
- Search icon
- Form submission handling
- Input state management

---

### 5.4 Profile Components

#### 5.4.1 ProfileSectionCard (`src/components/profile/ProfileSectionCard.tsx`)
**Purpose**: Display profile sections with expand/collapse

**Features**:
- **Expandable Items**: Toggle expand/collapse
- **Edit Buttons**: Edit functionality per item
- **Dynamic Content**: Renders different content based on section type
- **Status Indicators**: Visual status for completion

**Props**:
- `title`: Section title
- `items`: Array of section items
- `onEdit`: Edit handler
- `onAdd`: Add new item handler

**Item Types**:
- Work Experience
- Education
- Skills
- Certifications
- Projects
- Languages
- etc.

---

## 6. Modal Components

### 6.1 BasicInfoModal (`src/components/modals/BasicInfoModal.tsx`)
**Purpose**: Edit basic user information

**Fields**:
- Full name
- Email
- Phone number
- Gender
- Date of birth
- Location (country, city)
- Employment status

**Features**:
- Form validation
- Save/Cancel actions
- Date picker for DOB

---

### 6.2 WorkExperienceModal (`src/components/modals/WorkExperienceModal.tsx`)
**Purpose**: Add/edit work experience entries

**Fields**:
- Job title
- Company name
- Start/end dates
- Responsibilities (textarea)
- Skills used
- Currently working checkbox

**Features**:
- **Multiple Entries**: Add multiple work experiences
- **Gap Detection**: Automatically detects employment gaps
- **Gap Explanation Modal**: Prompts user to explain gaps
- **Date Validation**: Ensures end date is after start date
- **Delete Entry**: Remove work experience entries

**Gap Detection Logic**:
- Calculates time between end date of previous job and start date of current job
- Shows modal if gap > 30 days
- Allows user to explain gap (e.g., "Travel", "Education", "Personal")

---

### 6.3 EducationModal (`src/components/modals/EducationModal.tsx`)
**Purpose**: Add/edit education details

**Fields**:
- Education level (High School, Bachelor's, Master's, PhD)
- Degree name
- Institution name
- Start/end years
- Grade/GPA

**Features**:
- Year dropdowns (generated dynamically)
- Multiple education entries
- Delete functionality

---

### 6.4 SkillsModal (`src/components/modals/SkillsModal.tsx`)
**Purpose**: Manage user skills

**Features**:
- **Skill Management**:
  - Add skills manually
  - Remove skills
  - Set proficiency level (Beginner, Intermediate, Advanced, Expert)

- **AI Suggestions**:
  - **Hard Skills**: Technical skills
  - **Soft Skills**: Interpersonal skills
  - **Tools/Technologies**: Software/tools

- **Tabbed Interface**: Switch between user skills and AI suggestions
- **One-Click Add**: Add AI-suggested skills

**Data Structure**:
```typescript
interface Skill {
  name: string;
  proficiency: string;
  category?: string;
}
```

---

### 6.5 SummaryModal (`src/components/modals/SummaryModal.tsx`)
**Purpose**: Edit professional summary

**Features**:
- **Textarea Editor**: Large text area for summary
- **Character Counter**: 500 character limit with counter
- **Guidelines Panel**: Right-side panel with summary best practices
  - Your role or expertise
  - Years of experience
  - Core skills
  - Industry/domain focus
  - Achievements or strengths

- **AI Enhancement**: Button to generate summary with AI
- **Save/Cancel**: Standard modal actions

---

### 6.6 CareerPreferencesModal (`src/components/modals/CareerPreferencesModal.tsx`)
**Purpose**: Edit career preferences and job search criteria

**Sections**:
1. **Role & Domain**:
   - Preferred job titles (multi-select tags)
   - Preferred industry (dropdown)
   - Functional area/department (dropdown)

2. **Job Type & Work Mode**:
   - Job types (checkboxes): Full-time, Contract, Part-time, Freelance, Internship
   - Work modes (checkboxes): On-site, Hybrid, Remote

3. **Location Preferences**:
   - Preferred work locations (multi-select tags)
   - Relocation preference (dropdown)

4. **Salary Expectation**:
   - Currency (dropdown)
   - Amount (input)
   - Frequency (Annually, Monthly, Hourly)

5. **Availability**:
   - Availability to start (dropdown)
   - Notice period (optional dropdown)

**Features**:
- Tag-based inputs for job titles and locations
- Enter key to add tags
- Remove tags with X button
- Comprehensive form validation

---

### 6.7 ResumeModal (`src/components/modals/ResumeModal.tsx`)
**Purpose**: Upload/manage resume/CV

**Features**:
- **Drag & Drop**: Drag and drop file upload
- **File Picker**: Click to browse files
- **File Validation**:
  - Format: PDF, DOC, DOCX
  - Size: Max 5MB
- **File Preview**: Display uploaded file info
  - File name
  - Upload date
  - File size
- **File Actions**:
  - Preview (opens in new tab)
  - Replace (upload new file)
  - Delete (remove file)
- **AI Features Section**:
  - Auto-fill profile information
  - Generate ATS-ready structure
  - Suggest missing keywords

**Implementation**:
- `useRef` for file input
- Drag counter for proper drag leave detection
- File size and type validation
- Object URL for file preview

---

### 6.8 ApplicationSuccessModal (`src/components/modals/ApplicationSuccessModal.tsx`)
**Purpose**: Confirmation modal after job application

**Features**:
- Success message
- Applied job summary
- Action buttons:
  - Track Application (navigate to application detail)
  - Browse More Jobs (navigate to explore jobs)

---

### 6.9 Other Modals
Additional modals for various profile sections:
- `LanguagesModal.tsx`: Manage languages and proficiency
- `CertificationModal.tsx`: Add certifications
- `ProjectModal.tsx`: Add projects
- `PortfolioLinksModal.tsx`: Add portfolio links
- `AccomplishmentModal.tsx`: Add accomplishments
- `AcademicAchievementModal.tsx`: Add academic achievements
- `CompetitiveExamsModal.tsx`: Add competitive exam results
- `InternshipModal.tsx`: Add internships
- `VisaWorkAuthorizationModal.tsx`: Visa/work authorization info
- `VaccinationModal.tsx`: Vaccination status
- `GapExplanationModal.tsx`: Explain employment gaps

---

## 7. State Management Patterns

### 7.1 Local State (`useState`)
- **Primary Pattern**: Most components use `useState` for local state
- **Examples**:
  - Modal visibility (`isModalOpen`)
  - Form inputs (`value`, `focused`)
  - View toggles (`isGridView`, `isListMode`)
  - Filters and search terms

### 7.2 Session Storage
- **Usage**: Persist UI state across page refreshes
- **Examples**:
  - Notification read state
  - View preferences
  - Form progress

### 7.3 URL State (Next.js Router)
- **Usage**: Route-based state management
- **Examples**:
  - Active page detection (`usePathname`)
  - Navigation (`useRouter`)
  - Dynamic routes (`[id]`)

---

## 8. Styling & Design System

### 8.1 Tailwind CSS Classes
- **Responsive Design**: Mobile-first approach with breakpoints
- **Color Scheme**:
  - Primary: Blue (`blue-500`, `blue-600`)
  - Secondary: Orange (`orange-500`, `orange-600`)
  - Success: Green (`green-500`)
  - Warning: Yellow (`yellow-500`)
  - Error: Red (`red-500`)
  - Neutral: Gray scale (`gray-100` to `gray-900`)
  - Custom: `#9095A1` (placeholder gray), `#239CD2` (brand blue)

### 8.2 Custom CSS Variables
Defined in `globals.css`:
- Color variables
- Spacing variables
- Animation durations

### 8.3 Animations
- **Slide Down**: Dropdown menus
- **Gradient Shift**: Background gradients
- **Shimmer**: Loading states
- **Notification**: Slide-in and fade-out
- **Form Transitions**: Slide animations between form sections

### 8.4 Typography
- **Primary Font**: Geist Sans (via CSS variable)
- **Monospace Font**: Geist Mono
- **Secondary Font**: Arimo
- **Fallback**: Inter, sans-serif (explicitly set in some components)

---

## 9. Routing & Navigation

### 9.1 App Router Structure
- **File-based Routing**: Next.js App Router
- **Dynamic Routes**: `[id]` for dynamic segments
- **Nested Routes**: Folder-based nesting (e.g., `applications/[id]`)

### 9.2 Navigation Hooks
- **`useRouter`**: Programmatic navigation
  - `router.push(path)`: Navigate to route
  - `router.back()`: Go back
- **`usePathname`**: Get current pathname for active link detection

### 9.3 Route Protection
- **Note**: No explicit route protection found in analyzed code
- **Recommendation**: Implement authentication guards for protected routes

---

## 10. Data Flow & API Integration

### 10.1 Mock Data
- **Current State**: Most pages use hardcoded mock data
- **Examples**:
  - Job listings
  - Applications
  - Notifications
  - Courses
  - User profile data

### 10.2 Data Structures
Common interfaces used throughout:
- `JobListing`
- `Application`
- `Notification`
- `Course`
- `TimelineEvent`
- `CommunicationUpdate`
- `Skill`
- `Education`
- `WorkExperience`

### 10.3 API Integration Points
**Note**: No API calls found in analyzed code. Expected integration points:
- User authentication
- Profile CRUD operations
- Job search and filtering
- Application submission
- CV upload and analysis
- Notification fetching
- Course recommendations

---

## 11. AI Features

### 11.1 CV Analysis
- **CV Upload**: Extract information from uploaded CV
- **ATS Scoring**: Calculate ATS compatibility score
- **Keyword Suggestions**: Suggest missing keywords
- **Formatting Recommendations**: Improve CV structure

### 11.2 Job Matching
- **Match Percentage**: Calculate job match based on profile
- **AI Recommendations**: Suggest relevant jobs
- **Skill Gap Analysis**: Identify missing skills for jobs

### 11.3 Skill Suggestions
- **Categorized Suggestions**:
  - Hard Skills
  - Soft Skills
  - Tools/Technologies
- **Context-Aware**: Based on user profile and job market

### 11.4 CV Editor
- **Rewrite Suggestions**: AI-generated improvements
- **Keyword Optimization**: Add relevant keywords
- **Content Enhancement**: Improve clarity and impact

### 11.5 Course Recommendations
- **Personalized Suggestions**: Based on user skills and goals
- **AI Badge**: Highlighted AI-recommended courses

---

## 12. User Experience Features

### 12.1 Form UX
- **Floating Labels**: Animated labels that float on focus
- **Input Validation**: Real-time validation feedback
- **Multi-Step Forms**: Progress indication and navigation
- **Auto-Save**: Session storage for form progress

### 12.2 Visual Feedback
- **Loading States**: Spinners and progress bars
- **Status Indicators**: Color-coded badges
- **Hover Effects**: Interactive element feedback
- **Animations**: Smooth transitions

### 12.3 Responsive Design
- **Mobile-First**: Tailwind responsive classes
- **Breakpoints**: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- **Mobile Menu**: Hamburger menu for mobile navigation

### 12.4 Accessibility
- **Semantic HTML**: Proper HTML elements
- **ARIA Labels**: (Note: Should be verified and enhanced)
- **Keyboard Navigation**: Dropdown and form navigation
- **Focus States**: Visible focus indicators

---

## 13. Performance Considerations

### 13.1 Image Optimization
- **`next/image`**: Automatic image optimization
- **Lazy Loading**: Images load on demand
- **Responsive Images**: Different sizes for different screens

### 13.2 Code Splitting
- **Next.js Automatic**: Route-based code splitting
- **Dynamic Imports**: (Note: Not extensively used, could be optimized)

### 13.3 State Management
- **Local State**: Minimize unnecessary re-renders
- **Memoization**: (Note: Could benefit from `useMemo` and `useCallback`)

---

## 14. Security Considerations

### 14.1 Input Validation
- **Client-Side**: Basic validation in forms
- **Server-Side**: (Note: Should be implemented on backend)

### 14.2 File Upload
- **File Type Validation**: PDF, DOC, DOCX only
- **File Size Limits**: 5MB maximum
- **Sanitization**: (Note: Should be implemented on backend)

### 14.3 Authentication
- **WhatsApp OTP**: OTP-based authentication
- **Session Management**: (Note: Should be implemented with secure tokens)

---

## 15. Known Issues & Recommendations

### 15.1 Missing Features
1. **API Integration**: No actual API calls found
2. **Error Handling**: Limited error handling
3. **Loading States**: Some async operations lack loading indicators
4. **Route Protection**: No authentication guards
5. **Form Validation**: Could be more comprehensive

### 15.2 Optimization Opportunities
1. **Code Splitting**: Use dynamic imports for heavy components
2. **Memoization**: Add `useMemo` and `useCallback` where beneficial
3. **Image Optimization**: Ensure all images use `next/image`
4. **Bundle Size**: Analyze and optimize bundle size

### 15.3 Best Practices
1. **Type Safety**: Ensure all props are properly typed
2. **Error Boundaries**: Add React error boundaries
3. **Testing**: Add unit and integration tests
4. **Documentation**: Add JSDoc comments for complex functions

---

## 16. File Count Summary

### Pages (App Router)
- **Total Pages**: ~24 pages
- **Main Pages**: Landing, Dashboard, Profile, Explore Jobs, Applications, Courses, etc.
- **Auth Pages**: WhatsApp login and verification
- **Utility Pages**: Upload CV, Extract, CV Editor, CV Score

### Components
- **Common Components**: 2 (Header, Footer)
- **Layout Components**: 1 (DashboardContainer)
- **UI Components**: 4 (Button, Dropdown, EditText, SearchView)
- **Profile Components**: 1 (ProfileSectionCard)
- **Modal Components**: ~15+ modals

### Total Files Analyzed
- **Pages**: 24
- **Components**: 23+
- **Configuration Files**: 4
- **Total**: ~50+ files

---

## 17. Conclusion

This is a **comprehensive, feature-rich job portal application** with:

✅ **Strengths**:
- Modern tech stack (Next.js 16, React 19, TypeScript)
- Well-structured component architecture
- Extensive feature set (profile management, job search, applications, courses)
- Strong AI integration points
- Good UX with animations and responsive design
- Type-safe with TypeScript

⚠️ **Areas for Improvement**:
- API integration (currently using mock data)
- Error handling and loading states
- Route protection and authentication
- Performance optimization (code splitting, memoization)
- Testing coverage
- Documentation

The codebase is **production-ready** from a frontend perspective but requires **backend integration** and **security hardening** before deployment.

---

## Appendix: Key Code Patterns

### Pattern 1: Modal Structure
```typescript
if (!isOpen) return null;

return (
  <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal content */}
      </div>
    </div>
  </>
);
```

### Pattern 2: Floating Label Input
```typescript
const [isFocused, setIsFocused] = useState(false);
const [value, setValue] = useState('');

<input
  onFocus={() => setIsFocused(true)}
  onBlur={() => setIsFocused(false)}
  className={isFocused || value.length > 0 ? 'pt-5' : 'pt-3'}
/>
<label className={isFocused || value.length > 0 ? 'floating' : 'normal'}>
  Label
</label>
```

### Pattern 3: Active Link Detection
```typescript
const pathname = usePathname();
const isActive = (path: string) => pathname === path;
```

### Pattern 4: Tag Input (Enter to Add)
```typescript
const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && inputValue.trim()) {
    e.preventDefault();
    setTags([...tags, inputValue.trim()]);
    setInputValue('');
  }
};
```

---

**End of Analysis**
