# ADR-001: Database-per-tenant isolation (Phase 2)

- **Status:** Accepted  
- **Date:** 2025–2026 (codified 2026-09-17)  
- **Phase:** 2  

## Context

HRYantra CRM serves multiple staffing agencies / employer organisations. Customers and enterprise buyers require strong isolation so one tenant cannot read another’s candidates, clients, or billing data.

## Decision

Use **one MongoDB database per tenant**. On each request, resolve `tenantDbName` and run Prisma through `AsyncLocalStorage` (`runWithTenantContext`), rewriting the connection URL pathname to `/{tenantDbName}`.

## Consequences

**Positive**

- Strong physical isolation (queries cannot accidentally join across tenants).  
- Straightforward backup / export / delete per customer.  
- Clear story for security questionnaires.

**Negative / trade-offs**

- Schema migrations must be applied to every tenant DB.  
- Connection pooling / client cache complexity.  
- Cross-tenant analytics requires HQ or separate pipelines.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Shared DB + `tenantId` column | Higher risk of missing filters; harder to prove isolation |
| Schema-per-tenant (Postgres) | Stack standardized on Mongo + Prisma |
| Separate deployments per tenant | Operational cost too high for SMB SaaS |
