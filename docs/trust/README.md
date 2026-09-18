# HRYantra Trust & Architecture Pack (Phase 1 + Phase 2)

**Audience:** enterprise security / compliance / procurement reviews  
**Scope:** Candidate Job Portal (**Phase 1**) and Employer CRM (**Phase 2**)  
**Last updated:** 2026-09-17  

| Document | Description |
|----------|-------------|
| [01-architecture.md](./01-architecture.md) | System architecture diagrams (Phase 1, Phase 2, integrated) |
| [02-data-protection.md](./02-data-protection.md) | Data classification, storage, retention, access controls |
| [03-multi-tenancy-model.md](./03-multi-tenancy-model.md) | Tenant isolation, DB-per-tenant, sync boundaries |
| [04-adrs](./04-adrs/) | Architecture Decision Records |
| [05-pen-test-and-compliance.md](./05-pen-test-and-compliance.md) | Pen-test summary template + compliance certificate register |

### Product map

| Phase | Product | Frontend | Backend API | Public hosts (typical) |
|-------|---------|----------|-------------|------------------------|
| **1** | Candidate job portal | `jobportal_himanshu` (Next.js) | `backend1` Express `:5000` | `hryantra.com`, `api1.hryantra.com` |
| **2** | Employer CRM / recruitment | `frontphase2` (Next.js) | `backendphase2` Express `:5001` | `employers.hryantra.com`, `api2.hryantra.com` |

Related internal references: `docs/PRODUCTION_SECURITY_THREAT_MODEL.md`, `docs/phase1_complete_audit.md`, `docs/phase2_complete_audit.md`.
