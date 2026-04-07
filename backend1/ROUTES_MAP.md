# API Routes Map

Complete list of all API endpoints with HTTP methods, paths, authentication requirements, and frontend sections.

## Base URL
All routes are prefixed with `/api/v1/`

---

## Authentication Routes (`/api/v1/auth`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| POST | `/register` | No | `login` | Register a new user |
| POST | `/login` | No | `login` | Login and get JWT tokens |
| POST | `/logout` | Yes | All | Logout and clear refresh token |
| POST | `/refresh` | No | All | Refresh access token |
| POST | `/forgot-password` | No | `login` | Request password reset OTP |
| POST | `/verify-otp` | No | `login` | Verify OTP for password reset |
| POST | `/reset-password` | No | `login` | Reset password with verified OTP |

---

## User Routes (`/api/v1/users`)

| Method | Path | Auth Required | Role Required | Frontend Section | Description |
|--------|------|---------------|---------------|------------------|-------------|
| GET | `/` | Yes | Any | `administration`, `team` | Get all users (paginated) |
| GET | `/:id` | Yes | Any | `administration`, `team` | Get user by ID |
| PATCH | `/:id` | Yes | ADMIN, SUPER_ADMIN | `administration` | Update user |
| DELETE | `/:id` | Yes | SUPER_ADMIN | `administration` | Delete user |

---

## Candidate Routes (`/api/v1/candidates`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `candidate`, `matches`, `pipeline` | Get all candidates (paginated) |
| GET | `/:id` | Yes | `candidate` | Get candidate by ID |
| POST | `/` | Yes | `candidate` | Create new candidate |
| PATCH | `/:id` | Yes | `candidate` | Update candidate |
| DELETE | `/:id` | Yes | `candidate` | Delete candidate |

**Query Parameters:**
- `status` - Filter by candidate status
- `assignedToId` - Filter by assigned user
- `search` - Search by name or email
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

---

## Client Routes (`/api/v1/clients`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `client` | Get all clients (paginated) |
| GET | `/:id` | Yes | `client` | Get client by ID with contacts, jobs, placements |
| POST | `/` | Yes | `client` | Create new client |
| PATCH | `/:id` | Yes | `client` | Update client |
| DELETE | `/:id` | Yes | `client` | Delete client |

**Query Parameters:**
- `status` - Filter by client status
- `assignedToId` - Filter by assigned user
- `search` - Search by company name

---

## Contact Routes (`/api/v1/contacts`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `contacts` | Get all contacts (paginated) |
| GET | `/:id` | Yes | `contacts` | Get contact by ID |
| POST | `/` | Yes | `contacts` | Create new contact |
| PATCH | `/:id` | Yes | `contacts` | Update contact |
| DELETE | `/:id` | Yes | `contacts` | Delete contact |

**Query Parameters:**
- `type` - Filter by contact type (CLIENT, CANDIDATE, LEAD)
- `clientId` - Filter by client
- `search` - Search by name or email

---

## Job Routes (`/api/v1/jobs`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `job`, `matches`, `pipeline` | Get all jobs (paginated) |
| GET | `/:id` | Yes | `job` | Get job by ID with pipeline stages, matches, interviews |
| POST | `/` | Yes | `job` | Create new job (creates default pipeline stages) |
| PATCH | `/:id` | Yes | `job` | Update job |
| DELETE | `/:id` | Yes | `job` | Delete job |

**Query Parameters:**
- `status` - Filter by job status
- `clientId` - Filter by client
- `assignedToId` - Filter by assigned user
- `search` - Search by job title

---

## Lead Routes (`/api/v1/leads`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `leads` | Get all leads (paginated) |
| GET | `/:id` | Yes | `leads` | Get lead by ID |
| POST | `/` | Yes | `leads` | Create new lead |
| PATCH | `/:id` | Yes | `leads` | Update lead |
| POST | `/:id/convert` | Yes | `leads` | Convert lead to client |
| DELETE | `/:id` | Yes | `leads` | Delete lead |

**Query Parameters:**
- `status` - Filter by lead status
- `source` - Filter by lead source
- `assignedToId` - Filter by assigned user
- `search` - Search by name, email, or company

---

## Pipeline Routes (`/api/v1/pipeline`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/job/:jobId` | Yes | `pipeline` | Get all pipeline stages for a job |
| POST | `/job/:jobId/move` | Yes | `pipeline` | Move candidate to a different stage |
| POST | `/job/:jobId/stages` | Yes | `pipeline` | Create new pipeline stage |
| PATCH | `/stages/:stageId` | Yes | `pipeline` | Update pipeline stage |
| DELETE | `/stages/:stageId` | Yes | `pipeline` | Delete pipeline stage |

**Move Candidate Body:**
```json
{
  "candidateId": "string",
  "stageId": "string"
}
```

---

## Match Routes (`/api/v1/matches`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `matches` | Get all matches (paginated) |
| GET | `/:id` | Yes | `matches` | Get match by ID |
| POST | `/` | Yes | `matches` | Create new match |
| PATCH | `/:id` | Yes | `matches` | Update match status/notes |
| DELETE | `/:id` | Yes | `matches` | Delete match |

**Query Parameters:**
- `jobId` - Filter by job
- `candidateId` - Filter by candidate
- `status` - Filter by match status
- `minScore` - Filter by minimum score

---

## Interview Routes (`/api/v1/interviews`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `interviews` | Get all interviews (paginated) |
| GET | `/:id` | Yes | `interviews` | Get interview by ID |
| POST | `/` | Yes | `interviews` | Schedule new interview (sends email) |
| PATCH | `/:id` | Yes | `interviews` | Update interview |
| DELETE | `/:id` | Yes | `interviews` | Delete interview |

**Query Parameters:**
- `candidateId` - Filter by candidate
- `jobId` - Filter by job
- `status` - Filter by interview status
- `scheduledAt` - Filter by date

---

## Placement Routes (`/api/v1/placements`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `placement` | Get all placements (paginated) |
| GET | `/:id` | Yes | `placement` | Get placement by ID |
| POST | `/` | Yes | `placement` | Create new placement (sends email) |
| PATCH | `/:id` | Yes | `placement` | Update placement |
| DELETE | `/:id` | Yes | `placement` | Delete placement |

**Query Parameters:**
- `candidateId` - Filter by candidate
- `jobId` - Filter by job
- `clientId` - Filter by client
- `status` - Filter by placement status

---

## Billing Routes (`/api/v1/billing`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `billing` | Get all billing records (paginated) |
| GET | `/:id` | Yes | `billing` | Get billing record by ID |
| POST | `/` | Yes | `billing` | Create new billing record |
| PATCH | `/:id` | Yes | `billing` | Update billing record |
| DELETE | `/:id` | Yes | `billing` | Delete billing record |

**Query Parameters:**
- `clientId` - Filter by client
- `status` - Filter by billing status
- `dueDate` - Filter by due date

---

## Task Routes (`/api/v1/tasks`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `Task&Activites` | Get all tasks (paginated) |
| GET | `/:id` | Yes | `Task&Activites` | Get task by ID |
| POST | `/` | Yes | `Task&Activites` | Create new task |
| PATCH | `/:id` | Yes | `Task&Activites` | Update task |
| DELETE | `/:id` | Yes | `Task&Activites` | Delete task |

**Query Parameters:**
- `assignedToId` - Filter by assigned user
- `status` - Filter by task status
- `priority` - Filter by priority
- `linkedEntityType` - Filter by linked entity type
- `linkedEntityId` - Filter by linked entity ID

---

## Activity Routes (`/api/v1/activities`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `Task&Activites`, `dashboard` | Get all activities (paginated) |
| GET | `/:id` | Yes | `Task&Activites` | Get activity by ID |
| POST | `/` | Yes | `Task&Activites` | Create new activity |
| DELETE | `/:id` | Yes | `Task&Activites` | Delete activity |

**Query Parameters:**
- `entityType` - Filter by entity type
- `entityId` - Filter by entity ID
- `performedById` - Filter by user who performed activity

---

## Inbox Routes (`/api/v1/inbox`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/threads` | Yes | `inbox` | Get all message threads (paginated) |
| GET | `/threads/:id` | Yes | `inbox` | Get thread by ID with messages |
| POST | `/threads` | Yes | `inbox` | Create new thread with initial message |
| POST | `/threads/:threadId/messages` | Yes | `inbox` | Add message to thread |
| PATCH | `/threads/:threadId/read` | Yes | `inbox` | Mark messages as read |

**Query Parameters:**
- `relatedEntityType` - Filter by related entity type
- `relatedEntityId` - Filter by related entity ID
- `userId` - Filter by participant user

---

## Report Routes (`/api/v1/reports`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `reports` | Get all reports (paginated) |
| GET | `/:id` | Yes | `reports` | Get report by ID |
| POST | `/` | Yes | `reports` | Create new report |
| PATCH | `/:id` | Yes | `reports` | Update report |
| DELETE | `/:id` | Yes | `reports` | Delete report |

**Query Parameters:**
- `type` - Filter by report type
- `generatedById` - Filter by user who generated report

---

## Team Routes (`/api/v1/teams`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `team` | Get all teams (paginated) |
| GET | `/:id` | Yes | `team` | Get team by ID with members |
| POST | `/` | Yes | `team` | Create new team |
| PATCH | `/:id` | Yes | `team` | Update team |
| POST | `/:id/members` | Yes | `team` | Add member to team |
| DELETE | `/:id/members/:userId` | Yes | `team` | Remove member from team |
| DELETE | `/:id` | Yes | `team` | Delete team |

**Query Parameters:**
- `department` - Filter by department
- `search` - Search by team name

---

## Setting Routes (`/api/v1/settings`)

| Method | Path | Auth Required | Frontend Section | Description |
|--------|------|---------------|------------------|-------------|
| GET | `/` | Yes | `setting` | Get all settings (filtered by userId/scope) |
| GET | `/:key` | Yes | `setting` | Get setting by key |
| POST | `/` | Yes | `setting` | Create new setting |
| PATCH | `/:key` | Yes | `setting` | Update setting (upsert) |
| DELETE | `/:key` | Yes | `setting` | Delete setting |

**Query Parameters:**
- `userId` - Filter by user ID
- `scope` - Filter by scope (USER, ORG)

---

## Health Check

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/health` | No | Health check endpoint |

---

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Pagination

Most list endpoints support pagination via query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

## Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
