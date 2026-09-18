# ADR-006: Vercel frontend + EC2 API topology

- **Status:** Accepted  
- **Date:** Codified 2026-09-17  
- **Phase:** 1 + 2  

## Context

Need fast global frontend delivery and a stateful Node API with Mongo, S3, Socket.IO, and file streaming.

## Decision

- Host Next.js frontends on **Vercel** (portal + employers).  
- Host Express APIs on **EC2** behind **nginx** (`api1.hryantra.com`, `api2.hryantra.com`), process-managed with **PM2**.  
- Allow FE → API via direct API host and/or Next **`/api/proxy`** routes.  
- Store blobs on **AWS S3**; databases on Mongo (EC2 local or Atlas).

## Consequences

**Positive**

- FE CI/CD and edge caching are simple.  
- API can use long-lived sockets, large uploads, local tooling.

**Negative**

- Proxy is not an auth boundary — backend must enforce auth.  
- Single EC2 blast radius if DB co-located (see threat model).  
- CORS and allowlists must track Vercel preview URLs carefully.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Full AWS Amplify / ECS for FE+BE | Higher migration cost now |
| API also on Vercel serverless | Poor fit for Socket.IO / large uploads / Prisma multi-DB |
