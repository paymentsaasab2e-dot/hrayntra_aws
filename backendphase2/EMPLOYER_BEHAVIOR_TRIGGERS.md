# Employer behaviour triggers & People intel (paid)

How activity becomes recs for **the user**, **tenant admin**, and **Hryantra sales**.  
CRM and Recruitment are **separate monthly unlocks** (different coin SKUs). HQ can change prices later.

## Tracking (always on, free)

While people use the CRM / recruitment app we store **counts + entity ids**, not names:

| Signal | Meaning |
|--------|---------|
| Time / visits / first-open | How they work |
| Actions / API writes | Work actually done |
| Assigned / open / done | Workload they own |
| Overdue tasks | Blocked work |

Inspect: `/tenant-behave` and `GET /api/v1/tenant-behavior/engine`.

---

## Who gets which rec

### User (in-product nudge)

| Trigger | Fire when | Rec |
|---------|-----------|-----|
| Leads stall | Many open leads, ~0 converts, few actions | Move 1–2 leads today |
| Jobs without bench | Open jobs, 0 candidates | Source + submit 2 profiles |
| Browse, no write | Many opens, few saves | Finish one record |
| Task backlog | Overdue or many open / 0 done | Clear overdue first |
| Reports-only | Most time in reports | Do one funnel action |
| Interview → placement gap | Interviews up, placements 0 | Log offer / placement |

### Tenant admin (Team / People intel)

| Trigger | Fire when | Rec |
|---------|-----------|-----|
| Idle assignee | Lots assigned, almost no time | Reassign or check seat |
| Helper, no book | High actions, 0 owned leads/jobs | Give named ownership |
| Power user | High workflow + actions | Use as coach |
| Unassigned leads | 5+ ownerless leads | Bulk-assign |
| Thin pipeline | Open jobs, few candidates | Sourcing SLA |
| Overdue team tasks | 3+ overdue | Standup: overdue first |

### Hryantra sales / CS (HQ later — only tenant-wide)

Do **not** ping sales because one recruiter opened a lead.

| Trigger | Fire when | Rec |
|---------|-----------|-----|
| Idle seats | Many tracked, 1 active, few actions | Adoption / training / seats |
| Stuck CRM | Fat lead book, few clients, low actions | Onboarding, **not** upsell |
| Browse-only tenant | Visits, 0 writes | Setup blocked or tyre-kicker |
| Healthy funnel | Jobs + interviews/placements + real actions | Expansion (AI, seats, plan) |

---

## Paid People intel (dashboards)

Shown as **People intel** tab on:

- CRM dashboard (`/dashboard`) — SKU `intel.people_perf_crm` · **40 coins / 30 days**
- Recruitment dashboard (`/recruitment`) — SKU `intel.people_perf_recruitment` · **55 coins / 30 days**

Rules:

1. **Two purchases.** Unlocking CRM does **not** unlock Recruitment (and vice versa).
2. **Pay once per month** in coins. Until paid, the card is **faded** with Unlock overlay.
3. HQ later: same feature ids in **HQ → AI features** (override coins). Payment gateway can replace coin spend; entitlement stays `peoplePerfEntitlements` on org settings.
4. Recs on the CRM tab are CRM-weighted; recruitment tab is hiring-weighted. Sales flags can appear on both when the tenant pattern matches.

### APIs

```
GET  /api/v1/settings/org/people-perf
POST /api/v1/settings/org/people-perf/unlock   { "product": "crm" | "recruitment" }
```

Engine data: `GET /api/v1/tenant-behavior/engine?range=week`

### Marketing logic (why two prices)

| Product | Price | Why |
|---------|-------|-----|
| CRM intel | 40 | Wedge: managers see lead conversion & idle owners |
| Recruitment intel | 55 | Higher willingness-to-pay (desk load, placements, expansion) |

If HQ wants a bundle later, add a third SKU; do not auto-bundle these two.
