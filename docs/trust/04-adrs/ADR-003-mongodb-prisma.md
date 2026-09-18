# ADR-003: MongoDB + Prisma as primary data layer

- **Status:** Accepted  
- **Date:** Codified 2026-09-17  
- **Phase:** 1 + 2  

## Context

Product needs flexible document-shaped candidate profiles, rapid iteration on CRM entities, and multi-database tenancy for Phase 2.

## Decision

Use **MongoDB** with **Prisma** ORM for Phase 1 portal DB, Phase 2 tenant DBs, HQ, and related pools. Keep Redis optional for cache/realtime; S3 for blobs.

## Consequences

**Positive**

- Flexible nested profile / presentation JSON.  
- Prisma typing and migrations for teams already on Node.  
- Natural fit for DB-per-tenant URL swapping.

**Negative**

- Relational reporting is harder.  
- Multi-tenant migration tooling must be custom.  
- Transaction semantics differ from SQL.

## Alternatives considered

| Option | Why not |
|--------|---------|
| PostgreSQL + RLS | Would require rewrite; RLS alone weaker than DB-per-tenant for our sales story |
| Mongoose without Prisma | Less shared tooling across repos |
