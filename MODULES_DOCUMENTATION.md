# Complete Module Documentation: Leads, Clients, Jobs, and Candidates

## System Architecture Overview

The recruitment platform is built with:
- **Backend**: Node.js/Express with Prisma ORM and MongoDB
- **Frontend**: Next.js 15 with React/TypeScript
- **Database**: MongoDB with Prisma schema definitions

## Module Relationships

```
Lead → (Convert) → Client → (Creates) → Job
                                    ↓
Candidate → (Matches) → Job → (Has) → Pipeline Stages
                                    ↓
                            Match → Interview → Placement → Billing
```

## 1. LEADS MODULE

### Database Schema
- **Model**: `Lead` (collection: `leads`)
- **Status Flow**: New → Contacted → Qualified → Converted/Lost
- **Key Fields**:
  - `companyName`, `contactPerson`, `email`, `phone`
  - `type`: Company, Individual, Referral
  - `source`: Website, LinkedIn, Email, Referral, Campaign
  - `status`: New, Contacted, Qualified, Converted, Lost
  - `priority`: High, Medium, Low
  - `convertedToClientId`: Links to Client when converted
  - `assignedToId`: Links to User (recruiter)

### API Endpoints (`/api/v1/leads`)
- `GET /` - List all leads (paginated, filterable by status, source, assignedToId, search)
- `GET /:id` - Get lead details with notes
- `POST /` - Create new lead
- `PATCH /:id` - Update lead (tracks changes, sends follow-up emails)
- `POST /:id/convert` - Convert lead to client
- `DELETE /:id` - Delete lead

### Business Logic
1. **Lead Creation**: Creates activity log, assigns to recruiter
2. **Lead Update**: Tracks status changes, sends follow-up emails when `nextFollowUp` is set
3. **Lead Conversion**: Creates new Client record, updates Lead status to "Converted", links via `convertedToClientId`
4. **Activity Tracking**: All changes logged to Activity model

### Frontend Integration
- **Page**: `frontphase2/src/app/leads/page.tsx`
- **Components**: Lead list, filters, drawer for details
- **Data Flow**: Frontend → API → Prisma → MongoDB

### Key Files
- **Backend Service**: `backendphase2/src/modules/lead/lead.service.js`
- **Backend Controller**: `backendphase2/src/modules/lead/lead.controller.js`
- **Backend Routes**: `backendphase2/src/modules/lead/lead.routes.js`
- **Frontend Page**: `frontphase2/src/app/leads/page.tsx`

---

## 2. CLIENTS MODULE

### Database Schema
- **Model**: `Client` (collection: `clients`)
- **Status**: ACTIVE, PROSPECT, ON_HOLD, INACTIVE
- **Key Fields**:
  - `companyName`, `industry`, `website`, `logo`, `location`
  - `status`: ACTIVE, PROSPECT, ON_HOLD, INACTIVE
  - `assignedToId`: Links to User (account manager)
  - Relations: `contacts[]`, `jobs[]`, `placements[]`, `billingRecords[]`, `notes[]`, `files[]`

### API Endpoints (`/api/v1/clients`)
- `GET /` - List all clients (paginated, filterable by status, assignedToId, search)
- `GET /:id` - Get client with contacts, jobs, placements, notes, files, billing records
- `POST /` - Create new client
- `PATCH /:id` - Update client
- `DELETE /:id` - Delete client
- `GET /metrics` - Get client metrics (active clients, open jobs, candidates, placements, revenue)

### Business Logic
1. **Client Creation**: Stores company info, assigns to recruiter
2. **Client Metrics**: Calculates active clients, open jobs, candidates in progress, placements, revenue trends
3. **Related Data**: Includes counts of jobs, contacts, placements when fetching

### Related Models
- **ClientNote**: Notes attached to clients (with tags, pinning)
- **ClientFile**: Files/documents (NDA, Contract, SLA, Policy, Invoice, Job Brief)
- **Contact**: Contacts associated with client (can be primary, have preferred channels)

### Frontend Integration
- **Page**: `frontphase2/src/app/client/page.tsx`
- **Components**: Client list, drawer with tabs (Overview, Contacts, Jobs, Notes, Files, Billing)
- **Data Flow**: Frontend → API → Prisma → MongoDB

### Key Files
- **Backend Service**: `backendphase2/src/modules/client/client.service.js`
- **Backend Controller**: `backendphase2/src/modules/client/client.controller.js`
- **Backend Routes**: `backendphase2/src/modules/client/client.routes.js`
- **Client Notes Service**: `backendphase2/src/modules/client/client-note.service.js`
- **Client Files Service**: `backendphase2/src/modules/client/client-file.service.js`
- **Frontend Page**: `frontphase2/src/app/client/page.tsx`

---

## 3. JOBS MODULE

### Database Schema
- **Model**: `Job` (collection: `jobs`)
- **Status**: DRAFT, OPEN, ON_HOLD, CLOSED, FILLED
- **Type**: FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP
- **Key Fields**:
  - `title`, `description`, `requirements[]`, `skills[]`
  - `clientId`: Links to Client (required)
  - `assignedToId`: Links to User (recruiter)
  - `pipelineStages[]`: Custom pipeline stages for the job
  - Relations: `matches[]`, `interviews[]`, `placements[]`, `notes[]`, `files[]`

### API Endpoints (`/api/v1/jobs`)
- `GET /` - List all jobs (paginated, filterable by status, clientId, assignedToId, search)
- `GET /:id` - Get job with pipeline stages, matches, interviews, notes, files
- `POST /` - Create new job (automatically creates default pipeline stages)
- `PATCH /:id` - Update job
- `DELETE /:id` - Delete job
- `GET /metrics` - Get job metrics

### Business Logic
1. **Job Creation**: 
   - Creates default pipeline stages (Applied, Screening, Interview, Offer, Hired)
   - Links to client
   - Assigns to recruiter
2. **Pipeline Stages**: Each job has custom stages with order and color
3. **Job Metrics**: Calculates active jobs, new jobs this week, no candidates, near SLA, closed this month

### Related Models
- **PipelineStage**: Stages for job (Applied, Screening, Interview, etc.)
- **PipelineEntry**: Tracks which candidate is in which stage
- **JobNote**: Notes attached to jobs
- **JobFile**: Files attached to jobs (JD, Contract, Offer Letter, etc.)
- **Match**: Links candidates to jobs with score

### Frontend Integration
- **Page**: `frontphase2/src/app/job/page.tsx`
- **Components**: Job list/board view, drawer with tabs (Overview, Candidates, Pipeline, Notes, Files)
- **Data Flow**: Frontend → API → Prisma → MongoDB
- **Features**: List view, board view, filters, analytics cards

### Key Files
- **Backend Service**: `backendphase2/src/modules/job/job.service.js`
- **Backend Controller**: `backendphase2/src/modules/job/job.controller.js`
- **Backend Routes**: `backendphase2/src/modules/job/job.routes.js`
- **Job Notes Service**: `backendphase2/src/modules/job/job-note.service.js`
- **Job Files Service**: `backendphase2/src/modules/job/job-file.service.js`
- **Frontend Page**: `frontphase2/src/app/job/page.tsx`
- **Frontend Drawer**: `frontphase2/src/components/drawers/CreateJobDrawer.tsx`

---

## 4. CANDIDATES MODULE

### Database Schema
- **Model**: `Candidate` (collection: `candidates`)
- **Status**: NEW, ACTIVE, PLACED, INACTIVE, BLACKLISTED
- **Key Fields**:
  - `firstName`, `lastName`, `email` (unique), `phone`, `linkedIn`
  - `skills[]`, `experience`, `currentTitle`, `currentCompany`
  - `assignedToId`: Links to User (recruiter)
  - `salary`: JSON object with min/max/currency
  - Relations: `matches[]`, `interviews[]`, `placements[]`, `pipelineEntries[]`

### API Endpoints (`/api/v1/candidates`)
- `GET /` - List all candidates (paginated, filterable by status, assignedToId, search)
- `GET /:id` - Get candidate with interviews, placements, matches
- `POST /` - Create new candidate
- `PATCH /:id` - Update candidate
- `DELETE /:id` - Delete candidate

### Business Logic
1. **Candidate Creation**: Stores personal info, skills, experience
2. **Candidate Matching**: Linked to jobs via Match model with score
3. **Pipeline Tracking**: Moves through job pipeline stages via PipelineEntry

### Related Models
- **Match**: Links candidate to job with score and status (SUGGESTED, REVIEWED, SHORTLISTED, REJECTED)
- **Interview**: Scheduled interviews for candidate-job pairs
- **Placement**: Successful placements (when candidate joins)
- **PipelineEntry**: Tracks candidate position in job pipeline

### Frontend Integration
- **Page**: `frontphase2/src/app/candidate/page.tsx`
- **Components**: Candidate grid/table, filters, drawer
- **Data Flow**: Frontend → API → Prisma → MongoDB

### Key Files
- **Backend Service**: `backendphase2/src/modules/candidate/candidate.service.js`
- **Backend Controller**: `backendphase2/src/modules/candidate/candidate.controller.js`
- **Backend Routes**: `backendphase2/src/modules/candidate/candidate.routes.js`
- **Frontend Page**: `frontphase2/src/app/candidate/page.tsx`

---

## 5. MATCHES MODULE (Connects Candidates & Jobs)

### Database Schema
- **Model**: `Match` (collection: `matches`)
- **Status**: SUGGESTED, REVIEWED, SHORTLISTED, REJECTED
- **Key Fields**:
  - `candidateId`: Links to Candidate
  - `jobId`: Links to Job
  - `score`: Float (match score, e.g., 0-100)
  - `status`: Match status
  - `createdById`: User who created the match

### API Endpoints (`/api/v1/matches`)
- `GET /` - List matches (filterable by jobId, candidateId, status, minScore)
- `GET /:id` - Get match details
- `POST /` - Create new match
- `PATCH /:id` - Update match status/notes
- `DELETE /:id` - Delete match

### Business Logic
1. **Match Creation**: Links candidate to job with score
2. **Match Status Flow**: SUGGESTED → REVIEWED → SHORTLISTED → (REJECTED)
3. **Used in**: Job drawer shows candidates (matches) for the job

### Key Files
- **Backend Service**: `backendphase2/src/modules/match/match.service.js`
- **Backend Controller**: `backendphase2/src/modules/match/match.controller.js`
- **Backend Routes**: `backendphase2/src/modules/match/match.routes.js`

---

## Data Flow Architecture

```
Frontend (Next.js/React)
    ↓ HTTP Request (JWT Auth)
Backend API (Express)
    ↓ Service Layer Call
Service Module (Business Logic)
    ↓ Prisma Query
Prisma ORM
    ↓ MongoDB Query
MongoDB Database
    ↓ Data Response
Prisma ORM → Service → API → Frontend
```

## Common Patterns Across Modules

### 1. CRUD Operations
All modules follow standard CRUD:
- **Create**: `POST /api/v1/{module}`
- **Read**: `GET /api/v1/{module}` (list) or `GET /api/v1/{module}/:id` (single)
- **Update**: `PATCH /api/v1/{module}/:id`
- **Delete**: `DELETE /api/v1/{module}/:id`

### 2. Pagination
All list endpoints support:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- Response format: `{ data: [...], pagination: { page, limit, total, pages } }`

### 3. Filtering & Search
Common query parameters:
- `status`: Filter by status
- `assignedToId`: Filter by assigned user
- `search`: Text search (name, email, title, etc.)

### 4. Relations & Includes
When fetching by ID, includes related data:
- **Leads**: Includes `assignedTo`, `client`, `noteList`
- **Clients**: Includes `contacts`, `jobs`, `placements`, `notes`, `files`, `billingRecords`
- **Jobs**: Includes `client`, `assignedTo`, `pipelineStages`, `matches`, `interviews`, `notes`, `files`
- **Candidates**: Includes `assignedTo`, `interviews`, `placements`, `matches`

### 5. Activity Logging
All modules log activities:
- Created, Updated, Deleted actions
- Status changes
- Assignment changes
- Stored in `Activity` model with `entityType` and `entityId`

### 6. Notes & Files
Modules support notes and files:
- **Leads**: `LeadNote`
- **Clients**: `ClientNote`, `ClientFile`
- **Jobs**: `JobNote`, `JobFile`
- All include creator/uploader info, timestamps, tags

---

## Frontend-Backend Integration

### API Client (`frontphase2/src/lib/api.ts`)
- Centralized API client with `apiFetch` function
- Handles authentication (JWT tokens)
- Error handling and response parsing
- TypeScript interfaces for type safety

### Data Transformation
- Backend returns Prisma models
- Frontend transforms to UI-friendly formats
- Example: `mapBackendJob()` converts backend job to frontend `Job` interface

### State Management
- React `useState` for local component state
- API calls in `useEffect` hooks
- Loading and error states handled per component

---

## Complete Workflow Example

### Lead to Placement Flow

1. **Lead Created** (`POST /api/v1/leads`)
   - Lead enters system with status "New"
   - Assigned to recruiter
   - Activity logged

2. **Lead Updated** (`PATCH /api/v1/leads/:id`)
   - Status changes: New → Contacted → Qualified
   - Follow-up emails sent when scheduled
   - Activity logged

3. **Lead Converted to Client** (`POST /api/v1/leads/:id/convert`)
   - New Client record created
   - Lead status set to "Converted"
   - `convertedToClientId` links lead to client
   - Activity logged

4. **Job Created** (`POST /api/v1/jobs`)
   - Client creates job posting
   - Default pipeline stages created
   - Job assigned to recruiter
   - Activity logged

5. **Candidate Matched** (`POST /api/v1/matches`)
   - Candidate linked to job with match score
   - Match status: "SUGGESTED"
   - Candidate appears in job's candidate list

6. **Candidate Moves Through Pipeline** (`POST /api/v1/pipeline/job/:jobId/move`)
   - Candidate moved to different stage
   - PipelineEntry created/updated
   - Activity logged

7. **Interview Scheduled** (`POST /api/v1/interviews`)
   - Interview created for candidate-job pair
   - Email notifications sent
   - Activity logged

8. **Placement Created** (`POST /api/v1/placements`)
   - Successful placement recorded
   - Candidate status updated to "PLACED"
   - Activity logged

9. **Billing Record Created** (`POST /api/v1/billing`)
   - Invoice generated for placement
   - Linked to client and placement
   - Activity logged

---

## Summary

The platform follows a modular architecture where:

1. **Leads** are potential clients that can be converted to **Clients**
2. **Clients** create **Jobs** for positions they need filled
3. **Candidates** are matched to **Jobs** via the **Match** model
4. **Matches** flow through **Pipeline Stages** (Applied → Screening → Interview → Offer → Hired)
5. Successful matches lead to **Interviews** and eventually **Placements**
6. **Placements** generate **Billing Records** for revenue tracking

All modules support notes, files, activity logging, and assignment to users (recruiters/account managers).

---

## Additional Resources

- **API Routes Map**: `backendphase2/ROUTES_MAP.md`
- **Frontend-Backend Mapping**: `backendphase2/FRONTEND_TO_BACKEND_MAP.md`
- **Database Schema**: `backendphase2/prisma/schema.prisma`
- **Main App Routes**: `backendphase2/src/app.js`
