# ADR-002: Separate Phase 1 portal and Phase 2 CRM

- **Status:** Accepted  
- **Date:** Codified 2026-09-17  
- **Phase:** 1 + 2  

## Context

Candidates and recruiters have different UX, auth, release cadence, and trust boundaries. A single monolith would couple portal growth to CRM complexity.

## Decision

Ship two products:

| Phase | App | API |
|-------|-----|-----|
| 1 | `jobportal_himanshu` | `backend1` (`api1`) |
| 2 | `frontphase2` | `backendphase2` (`api2`) |

Integrate via controlled sync (`tenantDbName` + shared secret) and shared pools (`candidatecommon`) where needed.

## Consequences

**Positive**

- Independent deploy / scale.  
- Clearer security reviews per surface.  
- Portal can stay single-DB while CRM stays multi-tenant.

**Negative**

- Duplicate concepts (candidate, job, application).  
- Sync edge cases and dual auth models.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Single Next.js + single API | Tenancy + public portal risk mixed |
| BFF-only split, shared DB | Still weak isolation for CRM tenants |
