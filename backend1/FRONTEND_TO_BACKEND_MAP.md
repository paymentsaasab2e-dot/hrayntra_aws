# Frontend to Backend Field Mapping

This document provides a comprehensive mapping of all frontend fields, API calls, filters, enums, and status values to their corresponding backend implementations.

## Table of Contents
1. [Job Entity](#job-entity)
2. [Candidate Entity](#candidate-entity)
3. [Client Entity](#client-entity)
4. [Contact Entity](#contact-entity)
5. [Lead Entity](#lead-entity)
6. [Task Entity](#task-entity)
7. [Interview Entity](#interview-entity)
8. [Placement Entity](#placement-entity)
9. [Billing Entity](#billing-entity)
10. [User Entity](#user-entity)
11. [API Endpoints](#api-endpoints)
12. [Enums & Status Values](#enums--status-values)
13. [Filters & Search](#filters--search)

---

## Job Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `title` | `title` | String | Job title |
| `description` | `description` | String? | Job description |
| `overview` | `overview` | String? | Job overview |
| `keyResponsibilities` | `keyResponsibilities` | String[] | Key responsibilities array |
| `requiredSkills` | `skills` | String[] | Required skills |
| `preferredSkills` | `preferredSkills` | String[] | Preferred skills |
| `experienceRequired` | `experienceRequired` | String? | Experience requirement |
| `education` | `education` | String? | Education requirement |
| `benefits` | `benefits` | String[] | Benefits array |
| `location` | `location` | String? | Job location |
| `type` | `type` | JobType enum | FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP |
| `status` | `status` | JobStatus enum | DRAFT, PUBLISHED, CLOSED, ON_HOLD |
| `clientId` | `clientId` | String (ObjectId) | Foreign key to Client |
| `client.companyName` | `client.companyName` | String | Via relation |
| `client.logo` | `client.logo` | String? | Via relation |
| `assignedToId` | `assignedToId` | String? (ObjectId) | Foreign key to User |
| `assignedTo.name` | `assignedTo.name` | String | Via relation |
| `assignedTo.email` | `assignedTo.email` | String | Via relation |
| `assignedTo.avatar` | `assignedTo.avatar` | String? | Via relation |
| `openings` | `openings` | Int | Number of openings |
| `salary.min` | `salary.min` | Number | In salary JSON |
| `salary.max` | `salary.max` | Number | In salary JSON |
| `salary.currency` | `salary.currency` | String | In salary JSON |
| `postedDate` | `postedDate` | DateTime? | Posted date |
| `hiringManager` | `hiringManager` | String? | Hiring manager name |
| `hot` | `hot` | Boolean | Hot job flag |
| `aiMatch` | `aiMatch` | Boolean | AI match enabled |
| `noCandidates` | `noCandidates` | Boolean | No candidates flag |
| `slaRisk` | `slaRisk` | Boolean | SLA risk flag |
| `applied` | Computed | Int | Count from matches |
| `interviewed` | Computed | Int | Count from interviews |
| `offered` | Computed | Int | Count from placements |
| `joined` | Computed | Int | Count from placements with status JOINED |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/jobs` | Get all jobs (paginated) | `jobController.getAll` |
| GET | `/api/v1/jobs/:id` | Get job by ID | `jobController.getById` |
| POST | `/api/v1/jobs` | Create new job | `jobController.create` |
| PATCH | `/api/v1/jobs/:id` | Update job | `jobController.update` |
| DELETE | `/api/v1/jobs/:id` | Delete job | `jobController.delete` |

### Query Parameters

- `status`: Filter by job status
- `clientId`: Filter by client
- `assignedToId`: Filter by assigned user
- `search`: Search in title
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Candidate Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `firstName` | `firstName` | String | First name |
| `lastName` | `lastName` | String | Last name |
| `email` | `email` | String | Unique email |
| `phone` | `phone` | String? | Phone number |
| `linkedIn` | `linkedIn` | String? | LinkedIn URL |
| `resume` | `resume` | String? | Resume file URL |
| `skills` | `skills` | String[] | Skills array |
| `experience` | `experience` | Int? | Years of experience |
| `currentTitle` | `currentTitle` | String? | Current job title |
| `currentCompany` | `currentCompany` | String? | Current company |
| `location` | `location` | String? | Location |
| `status` | `status` | CandidateStatus enum | NEW, CONTACTED, INTERVIEWING, OFFERED, PLACED, REJECTED, ON_HOLD |
| `source` | `source` | String? | Source of candidate |
| `assignedToId` | `assignedToId` | String? (ObjectId) | Foreign key to User |
| `assignedTo.name` | `assignedTo.name` | String | Via relation |
| `assignedTo.email` | `assignedTo.email` | String | Via relation |
| `assignedTo.avatar` | `assignedTo.avatar` | String? | Via relation |
| `rating` | `rating` | Int? | Rating (1-5) |
| `noticePeriod` | `noticePeriod` | String? | Notice period |
| `hotlist` | `hotlist` | Boolean | Hotlist flag |
| `salary.min` | `salary.min` | Number | In salary JSON |
| `salary.max` | `salary.max` | Number | In salary JSON |
| `salary.currency` | `salary.currency` | String | In salary JSON |
| `dateOfBirth` | `dateOfBirth` | DateTime? | Date of birth |
| `gender` | `gender` | String? | Gender |
| `address` | `address` | String? | Address |
| `city` | `city` | String? | City |
| `state` | `state` | String? | State |
| `zipCode` | `zipCode` | String? | ZIP code |
| `country` | `country` | String? | Country |
| `workAuthorization` | `workAuthorization` | String? | Work authorization status |
| `availability` | `availability` | String? | Availability |
| `expectedSalary` | `expectedSalary` | Float? | Expected salary |
| `currentSalary` | `currentSalary` | Float? | Current salary |
| `education` | `education` | String? | Education |
| `certifications` | `certifications` | String[] | Certifications array |
| `languages` | `languages` | String[] | Languages array |
| `portfolio` | `portfolio` | String? | Portfolio URL |
| `github` | `github` | String? | GitHub URL |
| `website` | `website` | String? | Website URL |
| `notes` | `notes` | String? | Notes |
| `tags` | `tags` | String[] | Tags array |
| `preferredLocation` | `preferredLocation` | String? | Preferred location |
| `willingToRelocate` | `willingToRelocate` | Boolean | Willing to relocate |
| `remoteWorkPreference` | `remoteWorkPreference` | String? | Remote work preference |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/candidates` | Get all candidates (paginated) | `candidateController.getAll` |
| GET | `/api/v1/candidates/:id` | Get candidate by ID | `candidateController.getById` |
| POST | `/api/v1/candidates` | Create new candidate | `candidateController.create` |
| PATCH | `/api/v1/candidates/:id` | Update candidate | `candidateController.update` |
| DELETE | `/api/v1/candidates/:id` | Delete candidate | `candidateController.delete` |

### Query Parameters

- `status`: Filter by candidate status
- `assignedToId`: Filter by assigned user
- `search`: Search in firstName, lastName, email
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Client Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `companyName` | `companyName` | String | Company name |
| `industry` | `industry` | String? | Industry |
| `website` | `website` | String? | Website URL |
| `logo` | `logo` | String? | Logo URL |
| `status` | `status` | ClientStatus enum | PROSPECT, ACTIVE, INACTIVE, CLOSED |
| `assignedToId` | `assignedToId` | String? (ObjectId) | Foreign key to User |
| `assignedTo.name` | `assignedTo.name` | String | Via relation |
| `assignedTo.email` | `assignedTo.email` | String | Via relation |
| `assignedTo.avatar` | `assignedTo.avatar` | String? | Via relation |
| `address.street` | `address.street` | String | In address JSON |
| `address.city` | `address.city` | String | In address JSON |
| `address.state` | `address.state` | String | In address JSON |
| `address.zipCode` | `address.zipCode` | String | In address JSON |
| `address.country` | `address.country` | String | In address JSON |
| `companySize` | `companySize` | String? | Company size |
| `hiringLocations` | `hiringLocations` | String[] | Hiring locations array |
| `annualRevenue` | `annualRevenue` | String? | Annual revenue |
| `taxId` | `taxId` | String? | Tax ID |
| `paymentTerms` | `paymentTerms` | String? | Payment terms |
| `contractStartDate` | `contractStartDate` | DateTime? | Contract start date |
| `contractEndDate` | `contractEndDate` | DateTime? | Contract end date |
| `billingEmail` | `billingEmail` | String? | Billing email |
| `billingPhone` | `billingPhone` | String? | Billing phone |
| `billingAddress` | `billingAddress` | Json? | Billing address JSON |
| `notes` | `notes` | String? | Notes |
| `tags` | `tags` | String[] | Tags array |
| `hot` | `hot` | Boolean | Hot client flag |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/clients` | Get all clients (paginated) | `clientController.getAll` |
| GET | `/api/v1/clients/:id` | Get client by ID | `clientController.getById` |
| POST | `/api/v1/clients` | Create new client | `clientController.create` |
| PATCH | `/api/v1/clients/:id` | Update client | `clientController.update` |
| DELETE | `/api/v1/clients/:id` | Delete client | `clientController.delete` |

### Query Parameters

- `status`: Filter by client status
- `assignedToId`: Filter by assigned user
- `search`: Search in companyName, industry, website
- `hot`: Filter by hot flag (true/false)
- `tags`: Filter by tags (array)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Contact Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `firstName` | `firstName` | String | First name |
| `lastName` | `lastName` | String | Last name |
| `email` | `email` | String? | Email |
| `phone` | `phone` | String? | Phone number |
| `linkedIn` | `linkedIn` | String? | LinkedIn URL |
| `title` | `title` | String? | Job title |
| `type` | `type` | ContactType enum | CLIENT, CANDIDATE |
| `clientId` | `clientId` | String? (ObjectId) | Foreign key to Client |
| `candidateId` | `candidateId` | String? (ObjectId) | Foreign key to Candidate |
| `department` | `department` | String? | Department |
| `directPhone` | `directPhone` | String? | Direct phone |
| `extension` | `extension` | String? | Extension |
| `notes` | `notes` | String? | Notes |
| `tags` | `tags` | String[] | Tags array |
| `preferredContactMethod` | `preferredContactMethod` | String? | Preferred contact method |
| `timezone` | `timezone` | String? | Timezone |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/contacts` | Get all contacts (paginated) | `contactController.getAll` |
| GET | `/api/v1/contacts/:id` | Get contact by ID | `contactController.getById` |
| POST | `/api/v1/contacts` | Create new contact | `contactController.create` |
| PATCH | `/api/v1/contacts/:id` | Update contact | `contactController.update` |
| DELETE | `/api/v1/contacts/:id` | Delete contact | `contactController.delete` |

### Query Parameters

- `type`: Filter by contact type
- `clientId`: Filter by client
- `search`: Search in firstName, lastName, email
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Lead Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `firstName` | `firstName` | String | First name |
| `lastName` | `lastName` | String | Last name |
| `email` | `email` | String | Email |
| `phone` | `phone` | String? | Phone number |
| `company` | `company` | String? | Company name |
| `title` | `title` | String? | Job title |
| `source` | `source` | LeadSource enum | WEBSITE, REFERRAL, SOCIAL_MEDIA, EMAIL, PHONE, OTHER |
| `status` | `status` | LeadStatus enum | NEW, CONTACTED, QUALIFIED, CONVERTED, LOST |
| `notes` | `notes` | String? | Notes |
| `assignedToId` | `assignedToId` | String? (ObjectId) | Foreign key to User |
| `assignedTo.name` | `assignedTo.name` | String | Via relation |
| `assignedTo.email` | `assignedTo.email` | String | Via relation |
| `priority` | `priority` | String? | Priority (HIGH, MEDIUM, LOW) |
| `interestedNeeds` | `interestedNeeds` | String? | Interested needs |
| `convertedToClientId` | `convertedToClientId` | String? (ObjectId) | Foreign key to Client |
| `convertedToCandidateId` | `convertedToCandidateId` | String? (ObjectId) | Foreign key to Candidate |
| `convertedAt` | `convertedAt` | DateTime? | Conversion date |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/leads` | Get all leads (paginated) | `leadController.getAll` |
| GET | `/api/v1/leads/:id` | Get lead by ID | `leadController.getById` |
| POST | `/api/v1/leads` | Create new lead | `leadController.create` |
| PATCH | `/api/v1/leads/:id` | Update lead | `leadController.update` |
| POST | `/api/v1/leads/:id/convert` | Convert lead to client | `leadController.convertToClient` |
| DELETE | `/api/v1/leads/:id` | Delete lead | `leadController.delete` |

### Query Parameters

- `status`: Filter by lead status
- `source`: Filter by lead source
- `assignedToId`: Filter by assigned user
- `search`: Search in firstName, lastName, email, company
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Task Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `title` | `title` | String | Task title |
| `description` | `description` | String? | Task description |
| `dueDate` | `dueDate` | DateTime | Due date |
| `priority` | `priority` | TaskPriority enum | LOW, MEDIUM, HIGH, URGENT |
| `status` | `status` | TaskStatus enum | TODO, IN_PROGRESS, COMPLETED, CANCELLED |
| `assignedToId` | `assignedToId` | String (ObjectId) | Foreign key to User |
| `assignedTo.name` | `assignedTo.name` | String | Via relation |
| `assignedTo.email` | `assignedTo.email` | String | Via relation |
| `createdById` | `createdById` | String (ObjectId) | Foreign key to User |
| `createdBy.name` | `createdBy.name` | String | Via relation |
| `linkedEntityType` | `linkedEntityType` | LinkedEntityType enum | JOB, CANDIDATE, CLIENT, INTERVIEW, PLACEMENT |
| `linkedEntityId` | `linkedEntityId` | String? | Linked entity ID |
| `reminderDate` | `reminderDate` | DateTime? | Reminder date |
| `completedAt` | `completedAt` | DateTime? | Completion date |
| `tags` | `tags` | String[] | Tags array |
| `estimatedHours` | `estimatedHours` | Float? | Estimated hours |
| `actualHours` | `actualHours` | Float? | Actual hours |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/tasks` | Get all tasks (paginated) | `taskController.getAll` |
| GET | `/api/v1/tasks/:id` | Get task by ID | `taskController.getById` |
| POST | `/api/v1/tasks` | Create new task | `taskController.create` |
| PATCH | `/api/v1/tasks/:id` | Update task | `taskController.update` |
| DELETE | `/api/v1/tasks/:id` | Delete task | `taskController.delete` |

### Query Parameters

- `assignedToId`: Filter by assigned user
- `status`: Filter by task status
- `priority`: Filter by priority
- `linkedEntityType`: Filter by linked entity type
- `linkedEntityId`: Filter by linked entity ID
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Interview Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `candidateId` | `candidateId` | String (ObjectId) | Foreign key to Candidate |
| `candidate.firstName` | `candidate.firstName` | String | Via relation |
| `candidate.lastName` | `candidate.lastName` | String | Via relation |
| `candidate.email` | `candidate.email` | String | Via relation |
| `jobId` | `jobId` | String (ObjectId) | Foreign key to Job |
| `job.title` | `job.title` | String | Via relation |
| `clientId` | `clientId` | String (ObjectId) | Foreign key to Client |
| `client.companyName` | `client.companyName` | String | Via relation |
| `interviewerId` | `interviewerId` | String? (ObjectId) | Foreign key to User |
| `interviewer.name` | `interviewer.name` | String | Via relation |
| `interviewer.email` | `interviewer.email` | String | Via relation |
| `scheduledAt` | `scheduledAt` | DateTime | Scheduled date/time |
| `duration` | `duration` | Int? | Duration in minutes |
| `type` | `type` | InterviewType enum | PHONE, VIDEO, IN_PERSON |
| `status` | `status` | InterviewStatus enum | SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED |
| `location` | `location` | String? | Location |
| `meetingLink` | `meetingLink` | String? | Meeting link |
| `feedback` | `feedback` | String? | Feedback |
| `rating` | `rating` | Int? | Rating (1-5) |
| `notes` | `notes` | String? | Notes |
| `round` | `round` | Int? | Interview round |
| `interviewPanel` | `interviewPanel` | String[] | Interview panel array |
| `agenda` | `agenda` | String? | Agenda |
| `preparationNotes` | `preparationNotes` | String? | Preparation notes |
| `timezone` | `timezone` | String? | Timezone |
| `reminderSent` | `reminderSent` | Boolean | Reminder sent flag |
| `rescheduledFromId` | `rescheduledFromId` | String? (ObjectId) | Foreign key to Interview |
| `cancellationReason` | `cancellationReason` | String? | Cancellation reason |
| `noShowReason` | `noShowReason` | String? | No-show reason |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/interviews` | Get all interviews (paginated) | `interviewController.getAll` |
| GET | `/api/v1/interviews/:id` | Get interview by ID | `interviewController.getById` |
| POST | `/api/v1/interviews` | Create new interview | `interviewController.create` |
| PATCH | `/api/v1/interviews/:id` | Update interview | `interviewController.update` |
| DELETE | `/api/v1/interviews/:id` | Delete interview | `interviewController.delete` |

### Query Parameters

- `candidateId`: Filter by candidate
- `jobId`: Filter by job
- `status`: Filter by interview status
- `scheduledAt`: Filter by scheduled date
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Placement Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `candidateId` | `candidateId` | String (ObjectId) | Foreign key to Candidate |
| `candidate.firstName` | `candidate.firstName` | String | Via relation |
| `candidate.lastName` | `candidate.lastName` | String | Via relation |
| `candidate.email` | `candidate.email` | String | Via relation |
| `jobId` | `jobId` | String (ObjectId) | Foreign key to Job |
| `job.title` | `job.title` | String | Via relation |
| `clientId` | `clientId` | String (ObjectId) | Foreign key to Client |
| `client.companyName` | `client.companyName` | String | Via relation |
| `placedById` | `placedById` | String? (ObjectId) | Foreign key to User |
| `placedBy.name` | `placedBy.name` | String | Via relation |
| `startDate` | `startDate` | DateTime | Start date |
| `endDate` | `endDate` | DateTime? | End date |
| `salary` | `salary` | Float? | Salary |
| `fee` | `fee` | Float? | Placement fee |
| `feeType` | `feeType` | FeeType enum | FLAT, PERCENTAGE |
| `status` | `status` | PlacementStatus enum | PENDING, ACTIVE, COMPLETED, CANCELLED, OFFER_ACCEPTED, JOINING_SCHEDULED, JOINED, NO_SHOW, DROPPED |
| `notes` | `notes` | String? | Notes |
| `offerDate` | `offerDate` | DateTime? | Offer date |
| `offerAcceptedDate` | `offerAcceptedDate` | DateTime? | Offer accepted date |
| `joiningDate` | `joiningDate` | DateTime? | Joining date |
| `contractType` | `contractType` | String? | Contract type |
| `currency` | `currency` | String | Currency (default: USD) |
| `commissionRate` | `commissionRate` | Float? | Commission rate |
| `guaranteePeriod` | `guaranteePeriod` | Int? | Guarantee period in days |
| `guaranteePeriodStart` | `guaranteePeriodStart` | DateTime? | Guarantee period start |
| `guaranteePeriodEnd` | `guaranteePeriodEnd` | DateTime? | Guarantee period end |
| `invoiceNumber` | `invoiceNumber` | String? | Invoice number |
| `invoiceDate` | `invoiceDate` | DateTime? | Invoice date |
| `paymentReceivedDate` | `paymentReceivedDate` | DateTime? | Payment received date |
| `terminationDate` | `terminationDate` | DateTime? | Termination date |
| `terminationReason` | `terminationReason` | String? | Termination reason |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/placements` | Get all placements (paginated) | `placementController.getAll` |
| GET | `/api/v1/placements/:id` | Get placement by ID | `placementController.getById` |
| POST | `/api/v1/placements` | Create new placement | `placementController.create` |
| PATCH | `/api/v1/placements/:id` | Update placement | `placementController.update` |
| DELETE | `/api/v1/placements/:id` | Delete placement | `placementController.delete` |

### Query Parameters

- `candidateId`: Filter by candidate
- `jobId`: Filter by job
- `clientId`: Filter by client
- `status`: Filter by placement status
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

---

## Billing Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `clientId` | `clientId` | String (ObjectId) | Foreign key to Client |
| `client.companyName` | `client.companyName` | String | Via relation |
| `placementId` | `placementId` | String? (ObjectId) | Foreign key to Placement |
| `amount` | `amount` | Float | Amount |
| `currency` | `currency` | String | Currency (default: USD) |
| `status` | `status` | BillingStatus enum | DRAFT, SENT, PAID, OVERDUE, CANCELLED |
| `dueDate` | `dueDate` | DateTime? | Due date |
| `paidAt` | `paidAt` | DateTime? | Paid date |
| `invoiceUrl` | `invoiceUrl` | String? | Invoice URL |
| `notes` | `notes` | String? | Notes |
| `invoiceNumber` | `invoiceNumber` | String? | Invoice number |
| `description` | `description` | String? | Description |
| `taxAmount` | `taxAmount` | Float? | Tax amount |
| `discount` | `discount` | Float? | Discount |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/billing` | Get all billing records (paginated) | `billingController.getAll` |
| GET | `/api/v1/billing/:id` | Get billing record by ID | `billingController.getById` |
| POST | `/api/v1/billing` | Create new billing record | `billingController.create` |
| PATCH | `/api/v1/billing/:id` | Update billing record | `billingController.update` |
| DELETE | `/api/v1/billing/:id` | Delete billing record | `billingController.delete` |

---

## User Entity

### Frontend Fields → Backend Schema

| Frontend Field | Backend Field | Type | Notes |
|---------------|---------------|------|-------|
| `id` | `id` | String (ObjectId) | Primary key |
| `name` | `name` | String | Full name |
| `email` | `email` | String | Unique email |
| `passwordHash` | `passwordHash` | String | Hashed password (not exposed) |
| `role` | `role` | Role enum | ADMIN, RECRUITER, MANAGER, CLIENT |
| `department` | `department` | String? | Department |
| `avatar` | `avatar` | String? | Avatar URL |
| `isActive` | `isActive` | Boolean | Active status |
| `lastLogin` | `lastLogin` | DateTime? | Last login date |
| `phone` | `phone` | String? | Phone number |
| `createdAt` | `createdAt` | DateTime | Auto-generated |
| `updatedAt` | `updatedAt` | DateTime | Auto-updated |

### API Endpoints

| Method | Endpoint | Description | Controller |
|--------|----------|-------------|------------|
| GET | `/api/v1/users` | Get all users (paginated) | `userController.getAll` |
| GET | `/api/v1/users/:id` | Get user by ID | `userController.getById` |
| POST | `/api/v1/users` | Create new user | `userController.create` |
| PATCH | `/api/v1/users/:id` | Update user | `userController.update` |
| DELETE | `/api/v1/users/:id` | Delete user | `userController.delete` |

---

## Notes & Files

### Client Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/clients/:clientId/notes` | Get all notes for a client |
| POST | `/api/v1/clients/:clientId/notes` | Create a note for a client |
| PATCH | `/api/v1/clients/:clientId/notes/:noteId` | Update a note |
| DELETE | `/api/v1/clients/:clientId/notes/:noteId` | Delete a note |

### Client Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/clients/:clientId/files` | Get all files for a client |
| POST | `/api/v1/clients/:clientId/files` | Upload a file for a client |
| DELETE | `/api/v1/clients/:clientId/files/:fileId` | Delete a file |

### Job Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/jobs/:jobId/notes` | Get all notes for a job |
| POST | `/api/v1/jobs/:jobId/notes` | Create a note for a job |
| PATCH | `/api/v1/jobs/:jobId/notes/:noteId` | Update a note |
| DELETE | `/api/v1/jobs/:jobId/notes/:noteId` | Delete a note |

### Job Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/jobs/:jobId/files` | Get all files for a job |
| POST | `/api/v1/jobs/:jobId/files` | Upload a file for a job |
| DELETE | `/api/v1/jobs/:jobId/files/:fileId` | Delete a file |

### Lead Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leads/:leadId/notes` | Get all notes for a lead |
| POST | `/api/v1/leads/:leadId/notes` | Create a note for a lead |
| PATCH | `/api/v1/leads/:leadId/notes/:noteId` | Update a note |
| DELETE | `/api/v1/leads/:leadId/notes/:noteId` | Delete a note |

---

## Enums & Status Values

### JobType
- `FULL_TIME`
- `PART_TIME`
- `CONTRACT`
- `INTERNSHIP`

### JobStatus
- `DRAFT`
- `PUBLISHED`
- `CLOSED`
- `ON_HOLD`

### CandidateStatus
- `NEW`
- `CONTACTED`
- `INTERVIEWING`
- `OFFERED`
- `PLACED`
- `REJECTED`
- `ON_HOLD`

### ClientStatus
- `PROSPECT`
- `ACTIVE`
- `INACTIVE`
- `CLOSED`

### ContactType
- `CLIENT`
- `CANDIDATE`

### LeadSource
- `WEBSITE`
- `REFERRAL`
- `SOCIAL_MEDIA`
- `EMAIL`
- `PHONE`
- `OTHER`

### LeadStatus
- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `CONVERTED`
- `LOST`

### TaskPriority
- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

### TaskStatus
- `TODO`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### InterviewType
- `PHONE`
- `VIDEO`
- `IN_PERSON`

### InterviewStatus
- `SCHEDULED`
- `CONFIRMED`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`
- `RESCHEDULED`

### PlacementStatus
- `PENDING`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`
- `OFFER_ACCEPTED`
- `JOINING_SCHEDULED`
- `JOINED`
- `NO_SHOW`
- `DROPPED`

### FeeType
- `FLAT`
- `PERCENTAGE`

### BillingStatus
- `DRAFT`
- `SENT`
- `PAID`
- `OVERDUE`
- `CANCELLED`

### Role
- `ADMIN`
- `RECRUITER`
- `MANAGER`
- `CLIENT`

### LinkedEntityType
- `JOB`
- `CANDIDATE`
- `CLIENT`
- `INTERVIEW`
- `PLACEMENT`

---

## Filters & Search

### Common Query Parameters

All list endpoints support:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Text search (searches relevant fields)

### Job Filters
- `status`: JobStatus enum
- `clientId`: ObjectId
- `assignedToId`: ObjectId
- `type`: JobType enum
- `hot`: Boolean
- `aiMatch`: Boolean

### Candidate Filters
- `status`: CandidateStatus enum
- `assignedToId`: ObjectId
- `hotlist`: Boolean
- `source`: String
- `skills`: Array of strings (searches in skills array)

### Client Filters
- `status`: ClientStatus enum
- `assignedToId`: ObjectId
- `hot`: Boolean
- `tags`: Array of strings
- `industry`: String

### Contact Filters
- `type`: ContactType enum
- `clientId`: ObjectId
- `candidateId`: ObjectId

### Lead Filters
- `status`: LeadStatus enum
- `source`: LeadSource enum
- `assignedToId`: ObjectId
- `priority`: String (HIGH, MEDIUM, LOW)

### Task Filters
- `status`: TaskStatus enum
- `priority`: TaskPriority enum
- `assignedToId`: ObjectId
- `linkedEntityType`: LinkedEntityType enum
- `linkedEntityId`: ObjectId
- `dueDate`: Date range (gte, lte)

### Interview Filters
- `status`: InterviewStatus enum
- `candidateId`: ObjectId
- `jobId`: ObjectId
- `clientId`: ObjectId
- `scheduledAt`: Date range (gte, lte)
- `type`: InterviewType enum

### Placement Filters
- `status`: PlacementStatus enum
- `candidateId`: ObjectId
- `jobId`: ObjectId
- `clientId`: ObjectId
- `startDate`: Date range (gte, lte)

---

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": { ... }
}
```

---

## Authentication

All protected endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Auth Endpoints
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/reset-password` - Reset password

---

## Notes

1. All ObjectId fields are MongoDB ObjectIds (24-character hex strings)
2. All DateTime fields are ISO 8601 strings in UTC
3. All JSON fields are stored as MongoDB JSON/BSON
4. Pagination defaults: page=1, limit=10
5. All search queries are case-insensitive
6. All enum values are uppercase strings
7. Relations are included via `include` in Prisma queries
8. Computed fields (like counts) are calculated in services or via `_count` in Prisma

---

*Last Updated: 2024-12-19*
