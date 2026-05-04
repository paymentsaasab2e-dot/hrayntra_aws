# Code changes from ATS refactor & portal sessions (step-by-step)

This document records **what was implemented in code** during the Cursor sessions (stage-driven pipeline, portal sync, application page UX, multi-round interviews, assignee merge).  
If your local `hrayntra_aws` does **not** show these edits, use this as a **checklist to re-apply** or compare branches.

---

## 1. Phase 2 — central stage engine (new)

**Add file:** `backendphase2/src/modules/stage/candidateStage.service.js`

- Export **`PIPELINE_STAGES`**: `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`.
- **`mapPipelineStageToPortalApplicationStatus(stage)`** — maps to Prisma `ApplicationStatus` (e.g. APPLIED→SUBMITTED, INTERVIEW→INTERVIEW, HIRED→SELECTED, REJECTED→REJECTED; SCREENING→UNDER_REVIEW; OFFER→FINAL_DECISION).
- **`mapPipelineStageToCrmCandidateLabel(stage)`** — CRM candidate `stage` string (e.g. Interviewing, Selected).
- **`syncApplicationState(candidateId, jobId, options)`** — **portal DB only**: update `application`, append `applicationTimeline`, update portal `candidate.stage`; for INTERVIEW, move portal pipeline entry when applicable.
- **`updateCandidateStage({ candidateId, jobId, stage, metadata, reason, performedById, skipStageActivity })`** — tenant: update candidate stage/status; `application.updateMany` when `jobId`; optional STAGE_CHANGE activity; call `syncApplicationState`; on **HIRED**, mark tenant interviews COMPLETED for that job pair.

---

## 2. Phase 2 — portal sync (apply + assigned jobs)

**File:** `backendphase2/src/modules/internal/portal-sync.service.js` (if `internal` module exists)

1. Import **`PIPELINE_STAGES`**, **`updateCandidateStage`** from `../stage/candidateStage.service.js`.
2. **`assignedJobs` merge before upsert:** load existing tenant candidate’s `assignedJobs`, union with snapshot `assignedJobs` + current `jobId` — **do not** replace with `[jobId]` only when snapshot is empty (fixes multi-job applies).
3. After match + pipeline setup for apply, call **`updateCandidateStage({ stage: PIPELINE_STAGES.APPLIED, ... })`** (no `performedById` if no user).

---

## 3. Phase 2 — candidate service

**File:** `backendphase2/src/modules/candidate/candidate.service.js`

| Step | Change |
|------|--------|
| Imports | Import **`PIPELINE_STAGES`**, **`updateCandidateStage`** from stage service. |
| Remove | **`syncJobPortalAfterInterviewScheduled`** and **`pickInterviewPipelineStageId`** (portal logic moves to stage service). |
| Add | **`resolveJobIdForStageSync(candidateId, data)`** — optional `data.jobId`, else latest `match.jobId`. |
| **`scheduleInterview`** | Remove in-transaction **`candidate.update`** for stage (stage engine sets it). After transaction: **`updateCandidateStage(INTERVIEW, metadata: scheduledAt, interviewTitle, meetingLink, locationLine, mode, skipStageActivity: true)`**. |
| **`rejectCandidate`** | Replace duplicate rejection transaction with **`updateCandidateStage(REJECTED, metadata: reason/feedback, performedById)`**; keep optional pinned **internal note** activity if product requires it. |
| **`getAll` merge** | When merging portal + tenant candidates with same id, use **`mergePortalAndTenantCandidateRow`** — **union** `assignedJobs` from both rows. |
| List include | **`candidateListInclude.matches`**: increase **`take`** from `1` to **`40`** (or remove cap) so multiple job matches can load. |

---

## 4. Phase 2 — placement service

**File:** `backendphase2/src/modules/placement/placement.service.js`

- Remove **`syncJobPortalApplicationAfterPlacement`** (portal updates via stage engine only).
- Remove in-transaction candidate **`stage: 'Offer'`** update if hiring is driven by **HIRED** stage.
- After placement transaction: **`updateCandidateStage({ stage: PIPELINE_STAGES.HIRED, metadata: { placementId, jobTitle, offerDate }, performedById, skipStageActivity: true })`** — removes duplicate placement activity + portal sync; interview COMPLETED handled inside **`updateCandidateStage`**.

---

## 5. Phase 1 backend — application detail API

**File:** `backend1/src/controllers/application.controller.js`

### 5.1 Display status (Under Review vs Interview)

**`resolveApplicationDisplayStatus`:** If **`appStatus`** is one of **`INTERVIEW`**, **`FINAL_DECISION`**, **`SELECTED`**, **`REJECTED`**, **`SHORTLISTED`**, **`ASSESSMENT`** — return **`formatApplicationStatus(appStatus)` first** (do **not** let stale **`REVIEWED`** match override portal application status).

### 5.2 Multiple interview rounds in API

- From **`rawTimeline`**, filter **`status === 'INTERVIEW'`**, sort **ascending** by `occurredAt`.
- Build **`interviewRounds`**: array of objects per row: `timelineId`, `timelineTitle`, `scheduledAt`, `roundLabel`, `format`, `meetingLink`, `location`, `notes` (parse description like existing `parseInterviewDetailsFromDescription`).
- Keep **`interviewDetails`** as **latest** interview only (backward compatible).
- Add **`interviewRounds`** to JSON response for GET application detail.

### 5.3 Comment (optional)

- Update comment near **`parseInterviewDetailsFromDescription`** to reference Phase 2 **`syncApplicationState`** / INTERVIEW if desired.

---

## 6. Phase 1 frontend — job portal application page

**Path (typical):** `jobportal_himanshu/src/app/applications/[id]/page.tsx`  
(If the portal lives outside `hrayntra_aws`, mirror the same edits there.)

| Step | Change |
|------|--------|
| Types | **`statusCode`**, **`interviewRounds`**, **`InterviewRoundPayload`**. |
| **`PORTAL_STAGE_CARD`** | Map each **`ApplicationStatus`** to title, message, **`colorClass`**. |
| **`statusCodeAuthoritativeForDisplay`** | Used for pipeline index vs CRM label. |
| **`enrichPipelineStagesWithInterview`** | When terminal success + interview evidence + no “interview” named stage in pipeline, insert **Interview** before terminal pill. |
| **`stagePresentation`** | Prefer **`statusCode`** → **`PORTAL_STAGE_CARD`**; fallback interview when timeline shows interview but label still “Under Review”. |
| **`interviewRoundsStack`** | From API **`interviewRounds`**, else derive from timeline (interview rows, chronological). |
| **`timelineRowsForDisplay`** | If **`interviewRoundsStack.length`**, **strip interview rows** from main timeline (avoid duplicate with stacked section). |
| **Hero** | Use **`stagePresentation`** for title/message/color; if **`interviewRoundsStack.length > 0`**, hide single hero **Interview details** button; short hint text pointing to section below. |
| **New section** | **“Scheduled interviews”** — stacked cards (**Round 1 of N**), each with **Interview details** → modal (strip `timelineId` from payload). |
| **Pipeline / index** | Prefer **`application.status`** over stale **`pipelineStage`** when **`statusCode`** is authoritative. |

---

## 7. Verification checklist

- [ ] `backendphase2/src/modules/stage/candidateStage.service.js` exists.
- [ ] `portal-sync.service.js` merges **`assignedJobs`** and calls **`updateCandidateStage(APPLIED)`**.
- [ ] `candidate.service.js` calls **`updateCandidateStage`** for interview/reject; **`mergePortalAndTenantCandidateRow`** in **`getAll`**; matches **`take`** increased.
- [ ] `placement.service.js` calls **`updateCandidateStage(HIRED)`**; old portal placement sync removed.
- [ ] `application.controller.js`: **`resolveApplicationDisplayStatus`** prioritizes strong app statuses; response includes **`interviewRounds`**.
- [ ] Job portal **`applications/[id]/page.tsx`** has **`Scheduled interviews`** stack + **`PORTAL_STAGE_CARD`**.

---

## 8. If nothing appears in your clone

1. Run **`git branch -a`** and **`git status`** — confirm you’re on the branch where work was committed.
2. Search the repo: **`grep -r "updateCandidateStage" backendphase2`** and **`grep -r "interviewRounds" backend1`**.
3. Re-apply using the sections above, or cherry-pick / merge from the machine that has the commits.

---

## 9. Related docs (existing)

- `docs/PHASE1_AND_PHASE2_FLOW.md` — product flow; may still reference old symbol names until updated.

---

*Generated as a handoff reference; align filenames/paths with your actual repo layout (`internal` vs other routing for portal sync).*
