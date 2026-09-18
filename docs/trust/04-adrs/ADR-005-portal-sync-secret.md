# ADR-005: Shared secret for Phase 1 ↔ Phase 2 portal sync

- **Status:** Accepted  
- **Date:** Codified 2026-09-17  
- **Phase:** 1 + 2  

## Context

Portal applications must create / update pipeline state inside the correct Phase 2 tenant DB. End-user JWTs from Phase 1 must not authorize arbitrary CRM writes.

## Decision

Protect internal sync endpoints with a shared server secret:

- Header: `x-phase2-portal-sync-secret`  
- Env: `PHASE2_PORTAL_SYNC_SECRET`  
- Production must reject requests when the secret is unset or mismatched.  
- Route payload includes `tenantDbName` from the mirrored job.

## Consequences

**Positive**

- Simple machine-to-machine auth.  
- Separates candidate sessions from CRM privilege.

**Negative**

- Secret rotation requires coordinated deploy.  
- Compromise of either server’s env is high impact (rotate + audit).

## Alternatives considered

| Option | Why not |
|--------|---------|
| mTLS between services | Heavier ops on current EC2 setup |
| Signed JWT service account | Better long-term; can supersede this ADR later |
| Public apply APIs without secret | Unacceptable write surface |
