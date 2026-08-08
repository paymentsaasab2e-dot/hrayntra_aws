# How HRYANTRA AI Assistant Works (Phase 2)

This document explains how the **Phase 2** AI assistants work end-to-end: UI entry points, request flow, backend orchestration, tools, auth, coins, and history.

**Scope:** `frontphase2` + `backendphase2` only (not Phase 1 portal chat).

---

## 1. Overview — two assistants + helpers

Phase 2 runs **two chat assistants** side by side, plus form helpers and workspace intelligence.

| System | UI name | Primary entry | Backend base | LLM by default? | AI coins? |
|--------|---------|---------------|--------------|-----------------|-----------|
| **Enterprise Brain** | HRYANTRA Brain | Floating Brain FAB + Dashboard chat | `/api/v1/brain` | No (`BRAIN_USE_LLM=true` optional) | No |
| **ARIA** | ARIA · AI System Operator | Floating bot FAB | `/api/v1/ai/assistant-chat` | Yes (OpenAI → Mistral fallback) | Yes (`ai.assistant_chat`) |
| **Lead / Client AI** | Lead / Client assistant drawers | Add Lead / Add Client | `/api/v1/ai/lead-*`, `client-*` | Yes | Yes |
| **Workspace brief** | AI Workspace Brief / table alerts | Panels / entity alerts | `/api/v1/ai/workspace-brief*` | Yes (generate) | Yes (generate) |
| **Drawer intelligence** | Corner / overdue alerts | Global hosts (not a chat) | Client-side + CRM APIs | No | No |

Both FABs are mounted from the app layout via `FloatingBotMount`.

---

## 2. High-level system map

```mermaid
flowchart TB
  subgraph UI["Phase 2 Frontend — frontphase2"]
    Layout["app/layout.tsx"]
    FBM["FloatingBotMount"]
    BrainFAB["HrYantraAiFloatingButton<br/>HRYANTRA Brain"]
    AriaFAB["FloatingBotButton<br/>ARIA"]
    DashChat["DashboardBrainChat"]
    LeadAI["LeadAiChatDrawer"]
    ClientAI["ClientAiChatDrawer"]
    Intel["TenantIntelligenceHost<br/>+ TenantDrawerAnalysisHost"]
    Layout --> FBM
    Layout --> Intel
    FBM --> BrainFAB
    FBM --> AriaFAB
  end

  subgraph API["Phase 2 Backend — backendphase2"]
    Brain["/api/v1/brain/*"]
    AI["/api/v1/ai/*"]
    Auth["authMiddleware"]
    Coins["requireCoins feature gates"]
    LLM["llmChatFallback<br/>OpenAI → Mistral"]
    Prisma["Tenant Prisma DB<br/>+ AssistantPageHistory"]
    Brain --> Auth
    AI --> Auth
    AI --> Coins
    AI --> LLM
    Brain -.->|"optional BRAIN_USE_LLM"| LLM
    Brain --> Prisma
    AI --> Prisma
  end

  BrainFAB -->|"POST /brain/ask"| Brain
  DashChat -->|"POST /brain/ask"| Brain
  AriaFAB -->|"POST /ai/assistant-chat"| AI
  LeadAI -->|"POST /ai/lead-chat<br/>POST /ai/lead-details"| AI
  ClientAI -->|"POST /ai/client-chat<br/>POST /ai/client-details"| AI
```

---

## 3. User journey — which assistant when

```mermaid
flowchart TD
  Start([User is logged into Phase 2]) --> Page{Where is the user?}

  Page -->|Any main app page| FABs[Both FABs visible<br/>except login / apply / lead-form / HQ auth]
  Page -->|Dashboard with chat section| Dash[Dashboard Brain chat panel]
  Page -->|Add Lead drawer| Lead[Lead AI chat / paste extract]
  Page -->|Add Client drawer| Client[Client AI chat / paste extract]

  FABs --> Pick{Which FAB?}
  Pick -->|HRYANTRA Brain| BrainPath[Brain ask flow<br/>no coins]
  Pick -->|ARIA bot| AriaPath[ARIA assistant-chat<br/>AI coins required]

  Dash --> BrainPath
  Lead --> LeadPath[Lead AI + coins]
  Client --> ClientPath[Client AI + coins]
```

**Hidden routes (Brain FAB examples):** `/login`, `/hq/login`, `/apply*`, `/lead-form*`.  
ARIA also hides HQ / auth / public intake pages via `getAssistantPageConfig`.

---

## 4. Flow A — HRYANTRA Brain (Phase 2 Enterprise Brain)

### 4.1 End-to-end flowchart

```mermaid
flowchart TD
  U[User types question in Brain FAB<br/>or DashboardBrainChat] --> AskFn

  AskFn["askHrYantraLocalAssistant / apiBrainAsk"]
  AskFn --> Post["POST /api/v1/brain/ask<br/>authMiddleware"]

  Post --> Body["Body: question, sessionKey,<br/>pathname, messages,<br/>optional executeWorkflow"]

  Body --> RBAC["assertPermission brain_ask<br/>brainPermissions.service"]
  RBAC -->|denied| Err401[Error returned to UI]
  RBAC -->|ok| Orch["runBrainAsk<br/>brainOrchestrator.service"]

  Orch --> Mem["Load memory<br/>AssistantPageHistory<br/>pageKey = brain:sessionKey"]
  Orch --> Intent["detectIntent<br/>help / report / analytics /<br/>recommend / schema / workflow_hint /<br/>query / knowledge / general"]
  Orch --> RAG["brainRetrieval — platform knowledge"]
  Orch --> Schema["brainSchemaRegistry — entity map"]
  Orch --> Tools["BRAIN_TOOLS registry"]

  Tools --> T1["query_tenant_data"]
  Tools --> T2["get_schema_map"]
  Tools --> T3["run_analytics"]
  Tools --> T4["generate_report"]
  Tools --> T5["list_workflows / execute_workflow"]

  T1 --> Scope["Scoped Prisma queries<br/>full DB if ADMIN/MANAGER<br/>else ownership filters"]
  T5 --> WF["Approved writes only<br/>confirm: true required<br/>no deletes"]

  Scope --> Compose[Compose reply from live tool results]
  T2 --> Compose
  T3 --> Compose
  T4 --> Compose
  WF --> Compose
  RAG --> Compose
  Schema --> Compose

  Compose --> LLMOpt{BRAIN_USE_LLM=true?}
  LLMOpt -->|yes| Polish[Optional NL polish via LLM]
  LLMOpt -->|no| Reply[Deterministic / tool-based reply]
  Polish --> Reply

  Reply --> Audit["logBrainAction / audit"]
  Reply --> SaveMem[Update conversation memory]
  Reply --> Resp["Response: reply, intent, entities,<br/>usedTools, retrieval, auditId,<br/>llmEnabled, durationMs"]

  Resp --> UI[Show assistant message in FAB / dashboard]

  Post -.->|network / route failure<br/>non-auth| Fallback
  Fallback["Local fallback in hrYantraLocalAssistant.ts<br/>loadTenantSnapshot → detectIntent → compose"]
  Fallback --> UI
```

### 4.2 Brain request / response shapes

**Request (`POST /api/v1/brain/ask`):**

```json
{
  "question": "How many open leads do I have?",
  "sessionKey": "hryantra-ui",
  "pathname": "/leads",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "executeWorkflow": {
    "action_type": "create_task",
    "record_id": null,
    "payload": {},
    "confirm": true
  }
}
```

- FAB uses `sessionKey: "hryantra-ui"`.
- Dashboard chat uses `sessionKey: "dashboard-chat"`, `pathname: "/dashboard"`.

**Response `data`:** `reply`, `intent`, `entities`, `usedTools`, `retrieval`, `auditId`, `llmEnabled`, `durationMs`.

### 4.3 Approved Brain write workflows

Needs permission `brain_workflow` (typically MANAGER+) and `confirm: true`:

- Leads: `create_lead`, `update_lead`, `convert_lead_to_client`
- Clients: `create_client`, `update_client`
- Jobs: `create_job`, `update_job`
- Candidates: `update_candidate`, `move_candidate_stage`
- Interviews / tasks / placements: schedule, create/update/complete, mark joined

**Deletes are forbidden.**

### 4.4 Local fallback (no Brain / no OpenAI)

If `/brain/ask` fails (non-auth), the FAB still answers using CRM list/metric APIs:

1. `loadTenantSnapshot()` — leads, clients, jobs, candidates, tasks, interviews, placements, contacts, calendar (±14 days), module metrics  
2. Merge cached tenant intelligence (incomplete / overdue counts)  
3. `detectIntent` → pulse / next actions / risks / follow-ups / hot leads / search / how-to  
4. Compose a deterministic reply (optional spell-correction note)

---

## 5. Flow B — ARIA (AI System Operator)

### 5.1 End-to-end flowchart

```mermaid
flowchart TD
  U[User opens ARIA FAB] --> HistLoad["GET /ai/assistant-history/:pageKey"]
  HistLoad --> Panel[AssistantChatPanel shows history]

  U2[User sends message] --> Gate["useAiCoinGate ai.assistant_chat"]
  Gate -->|no coins / locked| Block[Show coin unlock UI]
  Gate -->|ok| Send["apiAssistantChat<br/>POST /api/v1/ai/assistant-chat"]

  Send --> Auth[authMiddleware]
  Auth --> Coins["requireCoins ai.assistant_chat"]
  Coins --> Run["runAssistantChat<br/>assistantChat.service"]

  Run --> Ctx["Build context:<br/>last ≤24 messages<br/>pageKey + pathname<br/>conversationMemory<br/>taskMemory + actionLog"]

  Ctx --> Loop["OpenAI tool loop<br/>MAX_TOOL_ROUNDS = 6"]

  Loop --> FT1["query_recruitment_data<br/>counts / lists / *_by_id"]
  Loop --> FT2["execute_recruitment_action<br/>approved writes"]
  Loop --> FT3["generate_report_file<br/>CSV / Excel / PDF"]

  FT1 --> Scope[assistantDataTools<br/>RBAC + ownership scope]
  FT2 --> Scope
  FT3 --> Files["uploads/assistant-reports"]

  Scope --> LLM["chatCompletionWithFallback<br/>OpenAI primary → Mistral"]
  Files --> LLM
  LLM --> Struct["Structured ARIA JSON:<br/>intent, actions, chatOutput,<br/>undoPayload, memory_update"]

  Struct --> SaveHist["PUT assistant-history/:pageKey"]
  Struct --> Resp["data.message + data.structured + history"]
  Resp --> UI[Render reply + optional UI payload event<br/>aria-ui-payload]
  UI --> Undo["Optional undo via apiExecuteUndo"]
```

### 5.2 ARIA request / response

**Request:**

```json
{
  "messages": [
    { "role": "user", "content": "List my overdue tasks" },
    { "role": "assistant", "content": "..." }
  ],
  "pageKey": "leads",
  "pathname": "/leads"
}
```

**Response `data`:**

```json
{
  "message": "You have 3 overdue tasks…",
  "structured": {
    "intent": "...",
    "actions": [],
    "chatOutput": "...",
    "undoPayload": {},
    "memory_update": {}
  },
  "history": {}
}
```

ARIA is **page-aware** (`PAGE_ASSISTANT_CONFIGS`) so prompts and report entity mapping follow the current route.

---

## 6. Flow C — Lead / Client AI drawers

Used while filling **Add Lead** or **Add Client** forms.

```mermaid
flowchart TD
  Open[Open Lead or Client AI drawer] --> Mode{Mode?}

  Mode -->|Paste extract| Paste["POST /ai/lead-details<br/>or /ai/client-details"]
  Mode -->|Multi-turn chat| Chat["POST /ai/lead-chat<br/>or /ai/client-chat"]

  Paste --> Coins1[Coins: ai.lead_details / ai.client_details]
  Chat --> Coins2[Coins: ai.lead_chat / ai.client_chat]

  Coins1 --> LLM[LLM structured JSON schema]
  Coins2 --> LLM

  LLM --> Patch["Response includes lead / client patch<br/>+ reply + readyToCreate"]
  Patch --> Apply["onApplyGenerated → merge into form"]
  Apply --> User[User reviews fields and clicks Create]

  note1[No function-calling tools<br/>History lives in React state only<br/>≤12 turns sent to API]
```

**Lead chat body:** `{ message, currentForm?, history? }`  
**Lead chat response:** `{ reply, readyToCreate, lead }`  

Same pattern for clients → `client` patch. Required fields are encoded in system prompts (e.g. lead: company + email).

---

## 7. Flow D — Workspace brief & drawer intelligence (not chat)

```mermaid
flowchart LR
  subgraph Chatless["Non-chat AI / intelligence"]
    Brief["aiWorkspaceBrief.service<br/>Mongo ai_workspace_briefs"]
    Recs["aiEntryRecommendation.service"]
    Drawer["tenant-drawer-engine<br/>analyzeLeadDrawer / analyzeClientDrawer"]
    Snap["phase2-intelligence<br/>refreshTenantIntelligence"]
  end

  Brief --> Alerts[Entity table alerts / panels]
  Recs --> RecUI[Entry recommendations]
  Drawer --> Corner[Corner / overdue popups]
  Drawer --> Snap
  Snap --> CRM[CRM snapshot for HQ / behavior]
```

- Drawer engine scans up to ~100 leads + ~100 clients for missing mandatory fields and overdue follow-ups/meetings.  
- Workspace brief generation is LLM + coin gated; stored alerts can surface in tables without a chat UI.

---

## 8. Auth, tenant isolation, and coins

```mermaid
flowchart TD
  Req[Incoming /ai or /brain request] --> Auth[authMiddleware → req.user]
  Auth --> Tenant[ALS / Prisma tenant DB isolation]
  Tenant --> Path{Route family?}

  Path -->|/brain/*| BRBAC[Brain RBAC<br/>brain_ask / brain_workflow]
  Path -->|/ai/* coin features| Coin[requireCoins feature key]
  Path -->|/ai history / undo| Hist[Auth only]

  BRBAC --> Tools[Scoped tools]
  Coin --> Tools
  Hist --> Tools

  Tools --> Full{Full DB access?}
  Full -->|SUPER_ADMIN / ADMIN / MANAGER<br/>or ASSISTANT_FULL_DB_ACCESS| All[Org-wide queries]
  Full -->|else| Own[Assigned / created ownership filters]
```

| Feature | Coin key (examples) |
|---------|---------------------|
| ARIA chat | `ai.assistant_chat` |
| Lead extract / chat | `ai.lead_details`, `ai.lead_chat` |
| Client extract / chat | `ai.client_details`, `ai.client_chat` |
| Job AI | `ai.job_*` variants |
| Workspace brief generate | `ai.workspace_brief` |
| Brain ask | **Not** coin-gated |

---

## 9. History & streaming

| Store | Key | Used by |
|-------|-----|---------|
| Prisma `AssistantPageHistory` | `userId` + `pageKey` | ARIA history; Brain memory as `brain:<sessionKey>` |
| React local state | — | Brain FAB, DashboardBrainChat, Lead/Client drawers |
| `localStorage` | FAB position keys only | Button placement |

**Streaming:** there is **no** SSE / token streaming for Brain or ARIA chat. Each ask is a full request/response cycle.

---

## 10. Key files (quick index)

### Frontend (`frontphase2`)

| File | Role |
|------|------|
| `src/components/FloatingBotMount.tsx` | Mounts ARIA + Brain FABs |
| `src/components/HrYantraAiFloatingButton.tsx` | Phase 2 Brain FAB UI |
| `src/lib/hrYantraLocalAssistant.ts` | Brain ask + local CRM fallback |
| `src/components/FloatingBotButton.tsx` | ARIA FAB + page configs |
| `src/components/AssistantChatPanel.tsx` | ARIA send / undo / coins UI |
| `src/components/dashboard/enterprise/DashboardBrainChat.tsx` | Dashboard Brain panel |
| `src/components/leads/LeadAiChatDrawer.tsx` | Lead AI drawer |
| `src/components/clients/ClientAiChatDrawer.tsx` | Client AI drawer |
| `src/lib/api.ts` | `apiBrainAsk`, `apiAssistantChat`, lead/client AI clients |
| `src/lib/tenant-drawer-engine/*` | Analyze + alert + track |
| `src/lib/phase2-intelligence/*` | Shared intelligence cache |
| `src/components/coins/AiCoinGate.tsx` | Feature coin unlock |

### Backend (`backendphase2`)

| File | Role |
|------|------|
| `src/modules/brain/README.md` | Brain module overview |
| `src/modules/brain/brain.routes.js` | `/brain` routes |
| `src/modules/brain/orchestration/brainOrchestrator.service.js` | `runBrainAsk` |
| `src/modules/brain/tools/brainTools.registry.js` | Secure tools |
| `src/modules/brain/workflow/brainWorkflow.service.js` | Approved writes |
| `src/modules/brain/memory/brainMemory.service.js` | Memory via `AssistantPageHistory` |
| `src/modules/ai/ai.routes.js` | `/ai` routes |
| `src/modules/ai/assistantChat.service.js` | `runAssistantChat` + OpenAI tools |
| `src/modules/ai/assistantDataTools.js` | Scoped query / action / report |
| `src/modules/ai/assistantHistory.service.js` | History persistence |
| `src/services/llmChatFallback.service.js` | OpenAI → Mistral |
| `src/services/aiWorkspaceBrief.service.js` | Workspace briefs / alerts |

---

## 11. One-page master flowchart

```mermaid
flowchart TB
  User((Phase 2 user))

  User --> BrainFAB[HRYANTRA Brain FAB]
  User --> AriaFAB[ARIA FAB]
  User --> FormAI[Lead / Client AI drawer]
  User --> Passive[Drawer intelligence<br/>auto scan]

  BrainFAB --> BAPI["POST /brain/ask"]
  BAPI --> BOrch[Intent → tools → analytics<br/>→ workflows → reply]
  BOrch --> Live[(Live tenant CRM data)]
  BAPI -.-> LocalFB[Local snapshot fallback]

  AriaFAB --> Coins{AI coins?}
  Coins -->|yes| AAPI["POST /ai/assistant-chat"]
  AAPI --> ToolLoop[LLM + function tools<br/>query / action / report]
  ToolLoop --> Live
  AAPI --> Hist[(AssistantPageHistory)]

  FormAI --> FAPI["POST /ai/lead-chat or client-chat<br/>or *-details extract"]
  FAPI --> SchemaLLM[Structured field patch]
  SchemaLLM --> Form[Merge into Add Lead / Client form]

  Passive --> Analyze[Missing fields / overdue]
  Analyze --> Alerts[Corner alerts + intelligence cache]

  BOrch --> Answer[Assistant text in UI]
  LocalFB --> Answer
  ToolLoop --> Answer
```

---

## 12. Guarantees (as implemented)

1. **Tenant isolation** — every ask runs against the authenticated user’s tenant DB.  
2. **RBAC before tools / workflows** — Brain and ARIA actions respect role + ownership.  
3. **No fabricated Brain metrics by design** — answers are meant to cite live tool results.  
4. **Audit** — Brain asks / tools / workflows are logged (`/brain/audit`).  
5. **Brain does not require OpenAI** unless `BRAIN_USE_LLM=true`.  
6. **ARIA and form AI do require LLM** (with Mistral fallback) and usually **AI coins**.  
7. **No delete workflows** through Brain / ARIA action tools.

---

*Generated from Phase 2 codebase paths under `hrayntra_aws/frontphase2` and `hrayntra_aws/backendphase2`.*
