# HRYANTRA Enterprise AI Brain (Phase 2)

Central intelligence layer for the Phase 2 platform.

## Architecture

```
src/modules/brain/
  orchestration/   # ask pipeline (intent → tools → answer)
  memory/          # conversation + intent memory (durable)
  retrieval/       # platform knowledge RAG (lexical; vector-ready)
  schema/          # entity & relationship registry
  reports/         # authorized inline / file reports
  analytics/       # live KPI snapshots + recommendations
  workflow/        # approved write actions (no deletes)
  monitoring/      # action audit + health
  permissions/     # RBAC gates
  tools/           # secure function registry
```

## API (`/api/v1/brain`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ask` | Natural-language ask (main entry) |
| GET | `/schema` | Module/entity registry |
| GET | `/schema/:entityId` | Entity + relationships |
| POST | `/retrieve` | RAG retrieval preview |
| GET | `/analytics` | Live tenant analytics |
| POST | `/reports` | Inline report generation |
| GET/POST | `/workflows` | List / execute approved workflows |
| GET | `/tools` | Registered tools |
| GET | `/memory` | Conversation memory |
| GET | `/health` | Service health |
| GET | `/audit` | Recent brain actions for user |

## Guarantees

- **Tenant isolation** via existing ALS Prisma tenant DB
- **RBAC** before tool / workflow execution
- **No fabricated metrics** — answers cite live tool results
- **Audit** every ask / tool / workflow
- **No OpenAI/Mistral by default** — set `BRAIN_USE_LLM=true` only if you want optional NL polish

## Frontend

HRYantra floating Brain calls `apiBrainAsk` → `/brain/ask`, with local CRM fallback if the route is unavailable.
