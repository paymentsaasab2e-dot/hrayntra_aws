# HRYantra tester walkthrough

Give this file to the tester. Work **one serial number at a time**. For each item: open the URL, follow the steps, mark **Pass / Fail / Blocked**, paste a screenshot into the **SCREEN SHOT** column of the tracker, and write a one-line note.

**Environment:** local only.

| App | URL | Typical API |
| --- | --- | --- |
| Phase 1 candidate portal | http://localhost:3000 | http://localhost:5000 |
| Phase 2 employer ATS | http://localhost:3001 | http://localhost:5001 |
| Headquarters | http://localhost:3001/hq | same Phase 2 API |

English marketing pages use the `/en/` prefix (example: http://localhost:3000/en/employers). Candidate app pages often work with or without `/en/`. If a link 404s, try the same path with `/en` in front.

**Accounts (ask the team for live passwords — do not reuse production secrets from old docs):**

| Role | Where to log in | Identifier |
| --- | --- | --- |
| Candidate | http://localhost:3000/whatsapp | WhatsApp + country code, or email |
| Employer / tenant | http://localhost:3001/login | tenant login ID + password |
| HQ | http://localhost:3001/hq/login | `admin@gmail.com` + HQ password |

**How to record a result**

- **Pass** — the expected result happened and you have a screenshot.
- **Fail** — UI/API did not match the expected result. Note the exact click and error.
- **Blocked** — login, data, or backend not running. Note what was missing.
- Status in this file is the **product tracker status**, not your test result.

---

## Before you start

1. Phase 1 frontend + `backend1` running.
2. Phase 2 frontend + `backendphase2` running.
3. Use two browsers (or one normal + one incognito) so candidate, employer, and HQ sessions do not overwrite each other.
4. Keep a blank screenshot folder: `Sr01`, `Sr02`, …

---

## 1. Auto-fetch country code

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate (logged out) |

**Go to:** http://localhost:3000/whatsapp

**Steps**

1. Open the page without changing VPN/timezone if possible.
2. Look at the WhatsApp country-code dropdown **before** you type anything.
3. Change the browser timezone (or use a second machine) if you need a second check (example: India vs US).
4. Switch Sign up / Sign in and confirm the same auto-fill still applies.

**Expected**

- Country code is pre-selected from timezone / browser locale (not always stuck on a hard-coded default).
- You can still pick another country manually.
- Flag + dial code match.

**Screenshot:** WhatsApp page with the auto-selected country code visible.

---

## 2. Mock interview skill matching (interviewer + candidate + reports)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed — reports still being implemented |
| Who | Candidate A (interviewer), Candidate B (seeker), HQ if verification is required |

### Module 1 — Become an interviewer

**Go to:** http://localhost:3000/lms/interview-prep/become-interviewer  
(or Services → Become an Interviewer: http://localhost:3000/en/services)

**Steps**

1. Log in as Candidate A.
2. Submit the interviewer registration form (skills, expertise, experience, charges, available days/slots).
3. Confirm the application status (pending / approved).
4. If HQ/admin verification exists in your build, approve Candidate A, then reload the interviewer page.
5. Look for a verified interviewer badge.
6. Confirm profile is live enough that Candidate B can find it.
7. As Candidate A, open interview requests, **Accept** one and **Reject** one.
8. Join the interview room from the request.
9. Submit a feedback report after the session.
10. Open any earnings / completed-interviews area on the same interviewer page (tabs at the top).

**Expected**

- Application saves.
- After approval, badge / live profile appears.
- Accept/reject updates the queue.
- Video/live room opens from the request.
- Feedback can be submitted.
- Earnings / scheduled / completed / ratings sections exist or clearly show “coming soon” if reports are unfinished.

### Module 2 — Candidate books a mock interview

**Go to:** http://localhost:3000/lms/interview-prep  
then http://localhost:3000/lms/interview-prep/request-interview

**Steps**

1. Log in as Candidate B (different account).
2. Complete profile if the page blocks booking.
3. Browse interviewers. Filter by technology, experience, rating, price if those filters exist.
4. Open one interviewer profile.
5. Send a request, pick an available slot, complete payment / coin unlock if asked.
6. Confirm booking.
7. Join the mock interview (candidate room).
8. After the session, open the feedback report and rate the interviewer.

**Matching flow to confirm**

Candidate selects slot → payment/unlock succeeds → slot is no longer offered to someone else → meeting/room is created → interview happens → feedback exists.

**Reports to confirm**

- Candidate: interview history, feedback, ratings, completed interviews.
- Interviewer: earnings, scheduled, completed, ratings, availability.

**Screenshot:** interviewer form, candidate booking, and at least one report/history screen.

**Note:** Tracker says reports are still being implemented. If a report tab is missing, mark **Fail** with “report UI missing”, not Blocked.

---

## 3. Interview prep schedule — per-person calendar + conflict alert

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | Deployed |
| Who | Employer recruiter |

**Go to:** http://localhost:3001/login → http://localhost:3001/calendar  
Also: http://localhost:3001/interviews → schedule an interview

**Steps**

1. Open **Calendar**.
2. Use the person/team selector (My calendar / a teammate / all).
3. Confirm each selected person shows **their** interviews, tasks, and meetings — not a single shared dump only.
4. Open **Interviews** and schedule a slot for a person who already has an interview at that time.
5. Confirm the conflict alert (“already scheduled” / interview conflict) appears.
6. Pick a free slot on that person’s calendar and save. Confirm it appears on that user’s calendar.

**Expected**

- Calendar is per user.
- Double-booking shows an alert and does not silently overwrite.
- New interview lands on the selected person’s calendar.

**Screenshot:** calendar person selector + conflict alert.

---

## 4. Course recommendations (Udemy / Academy / Coursera / YouTube in container)

| Field | Value |
| --- | --- |
| Category | Phase 1 + HQ publish |
| Tracker status | Deployed — UI still being improved |
| Who | HQ publisher + candidate |

**HQ publish**

1. http://localhost:3001/hq/login → http://localhost:3001/hq/courses
2. Create a course (title, category, thumbnail/video if available).
3. Mark **Published**.
4. Confirm it is not stuck in Draft.

**Candidate consume**

1. http://localhost:3000/candidate-dashboard — **Recommended courses** panel.
2. http://localhost:3000/lms/courses and http://localhost:3000/en/courses
3. Open a recommended course.
4. Confirm suggestions name a source (Udemy / Academy / Coursera / YouTube).
5. For YouTube, the video must play **inside the page container**, not only as an external tab.

**Expected**

- HQ-published course appears on Phase 1.
- Recommendations are visible on dashboard/LMS.
- YouTube plays in-page.

**Screenshot:** HQ course list (published) + candidate recommendation + in-page video.

---

## 5. Interviewer eligibility — KYC verified tag

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | **In progress** |
| Who | Candidate |

**Go to:** http://localhost:3000/lms/interview-prep/become-interviewer  
Profile/KYC: http://localhost:3000/profile and http://localhost:3000/completion-profile

**Steps**

1. Try Become Interviewer **without** KYC / verification.
2. Complete whatever KYC/verification the profile offers.
3. Reload Become Interviewer.
4. Look for **KYC verified** (or Verified) tag on the interviewer profile/application.

**Expected (when complete)**

- Ineligible candidate is blocked or warned.
- After KYC, they can apply and show a verified tag.

**If KYC gate is missing:** mark **Fail** / still in progress, screenshot the form with no verified tag.

---

## 6. Events portal and application (Office Gossips Events)

| Field | Value |
| --- | --- |
| Category | Phase 1 (events posted from Phase 2 / HQ) |
| Tracker status | Deployed — HQ/employer integration still being checked |
| Who | HQ or employer (create) + candidate (view/apply) |

**Create / publish**

- HQ: http://localhost:3001/hq/events
- Employer: http://localhost:3001/events

**Candidate**

1. http://localhost:3000/community?tab=events  
   Also: http://localhost:3000/lms/events and http://localhost:3000/en/events
2. Confirm events are shortlisted / relevant, not a random dump.
3. Open one event.
4. Apply / register.
5. Confirm the application is stored (success toast or “registered”).

**Expected**

- Candidate sees events under Office Gossips → Events.
- Apply works.
- New HQ/employer event eventually appears (allow a refresh). If it never appears, mark Fail on **integration**, not on UI.

**Screenshot:** HQ/employer event + candidate Events tab + apply success.

---

## 7. Personalized job feed

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/whatsapp → complete profile → http://localhost:3000/uploadcv  
Then: http://localhost:3000/candidate-dashboard and http://localhost:3000/en/explore-jobs or http://localhost:3000/en/searchjobs

**Steps**

1. Complete profile and upload a resume.
2. Search/apply for 1–2 jobs (so history exists).
3. Open dashboard **Job matches / recommendations**.
4. Confirm jobs relate to skills, resume, and recent searches — not only a generic latest-jobs list.
5. Apply from the recommendation card.
6. Confirm dashboard/pipeline updates.

**Expected**

- Personalized block is labelled or obviously matched to the profile.
- Apply updates applications / dashboard.

**Screenshot:** dashboard recommendations next to the candidate’s skills.

---

## 8. Community reviews / BGV reference check

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates (or candidate + company page) |

**Go to:** http://localhost:3000/community  
Reference flow: http://localhost:3000/reference-check

**Steps**

1. Open Community / Office Gossips.
2. Open a company or user profile.
3. Start a **reference check** / review (BGV style).
4. Send the request, accept on the other account, complete the check.
5. Confirm the review/reference result is visible on the profile or reference-check page.

**Expected**

- Request → accept → result, not a dead form.
- Reviews persist after refresh.

**Screenshot:** reference request and completed review.

---

## 9. LMS / community flow (search company, request, accept, chat/call, paid reference)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed — end-to-end still to be tested |
| Who | Two logged-in candidates |

**Go to:** http://localhost:3000/community  
Tabs: **Feed**, **Communities**, **Chat**, **Events**

**Steps**

1. Search a company from community.
2. Open the company page.
3. Send a follow/message/reference request.
4. On the second account, accept.
5. Open **Chat** (direct and any group/community chat).
6. If call is offered, start it or confirm the control exists.
7. Run a **paid** reference-check path if coins/payment is required — confirm unlock + chat still works.
8. Post or view **Feed**. Join a community.

**Expected**

- Search, request, accept, chat all work.
- Paid reference is gated until payment/coins, then unlocked.

**Screenshot:** company search, accept, and chat thread.

---

## 10. Company verification checks (LinkedIn, website, social, reviews, BGV, GST)

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **In progress** — Gmail login enabled; GST/extra checks being added |
| Who | Employer (Gmail/company login) + HQ |

**Go to:** http://localhost:3001/login (Gmail-based employer if available)  
Company record: http://localhost:3001/client or HQ http://localhost:3001/hq/company  
Org settings: http://localhost:3001/setting

**Steps**

1. Create or open a company with a real website + LinkedIn URL.
2. Look for verification status (website, LinkedIn, social, reviews, BGV, GST).
3. Save invalid GST / fake domain and confirm validation errors.
4. Save valid-looking details and confirm what actually gets verified vs only stored.

**Expected (when complete)**

- Gmail-based employer can create a company.
- Invalid GST/domain is rejected.
- Verification badges or statuses show per channel.

**If only fields save with no check:** mark **Fail** (in progress). Screenshot the company form.

---

## 11. Points-based gamification + refer-a-friend token

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/candidate-dashboard (Pending earn / coins)  
http://localhost:3000/subscriptions (Premium + Earn tabs)  
http://localhost:3000/user-stats

**Steps**

1. Note starting coin/point balance.
2. Complete an earn task (profile, apply, LMS action).
3. Confirm balance increases and a celebration/toast may appear.
4. Find **refer a friend** / invite token. Copy the token/link.
5. Sign up a second candidate with that token if the UI supports it.
6. Confirm referrer gets a reward (or a pending reward).

**Expected**

- Points/coins move after real actions.
- Referral token exists and is usable.

**Screenshot:** balance before/after + referral token.

---

## 12. Post-rejection subscription flow

| Field | Value |
| --- | --- |
| Category | Phase 1 + HQ flag |
| Tracker status | Deployed |
| Who | Candidate + HQ |

**Candidate**

1. Apply to several jobs from http://localhost:3000/en/explore-jobs
2. From Phase 2, reject those applications if you control the job (http://localhost:3001/job → pipeline reject), **or** ask the team to mark continuous rejections on the test account.
3. Watch candidate notifications (bell in header) and any subscription prompt: http://localhost:3000/subscriptions

**HQ**

1. http://localhost:3001/hq?view=employee and any behaviour / sales flag UI.
2. Confirm a combination trigger flags the user for sales **and** notifies the candidate.

**Expected**

- After repeated rejections, candidate gets a subscription/nudge.
- HQ/sales sees a flag, not only a silent DB write.

**Screenshot:** candidate notification/prompt + HQ flag.

---

## 13. Dashboard suggestions customization (LMS)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/candidate-dashboard and http://localhost:3000/lms

**Steps**

1. Note LMS/course/job suggestions on first load.
2. Complete a course, change skills, or browse another LMS area.
3. Reload dashboard.
4. Confirm suggestions **change** (not a static list).

**Expected**

- Suggestions are dynamic after activity.

**Screenshot:** dashboard suggestions before and after an LMS action.

---

## 14. Phase 1 and Phase 2 subscriptions at HQ dashboard

| Field | Value |
| --- | --- |
| Category | Both / HQ |
| Tracker status | Deployed — dashboard data still being shortlisted |
| Who | HQ |

**Go to:**

- Employee view: http://localhost:3001/hq?view=employee
- Employer view: http://localhost:3001/hq?view=employer
- Phase 1 packs: http://localhost:3001/hq/subscriptions
- Phase 2 plans: http://localhost:3001/hq?tab=plans

**Steps**

1. Confirm HQ home shows **both** employee (Phase 1) and employer (Phase 2) subscription/plan stats — not one side only.
2. Open Phase 1 coin packs and Phase 2 tenant plans.
3. Confirm numbers look business-specific (counts, plans, revenue/pack usage), not empty placeholders.

**Expected**

- Both phases visible from HQ.
- Stats are readable for a business reviewer.

**Screenshot:** HQ employee dashboard + employer dashboard + subscriptions/plans.

---

## 15. Activity notification system

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** any logged-in Phase 1 page (header bell). Dashboard: http://localhost:3000/candidate-dashboard

**Steps**

1. Apply to a job, receive a community request, or earn coins.
2. Open the notification bell.
3. Click a notification and confirm it deep-links to the right page.
4. Mark one read / mark all read.

**Expected**

- New activity creates a notification.
- List is newest-first and clickable.

**Screenshot:** open notification tray with a real event.

---

## 16. Activity and suggestion alerts (in-app / push)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** stay on http://localhost:3000/candidate-dashboard after login. Alerts also appear via the floating alerts host.

**Steps**

1. Trigger a suggestion (job match, LMS, course).
2. Confirm an in-app alert/toast/banner appears without only sitting in the bell.
3. If browser permission is requested, allow it and confirm a push (local browsers may block push — then record **Blocked: browser push** but still pass in-app).

**Expected**

- In-app suggestion alerts fire.
- Push is optional; note if permission/OS blocked it.

**Screenshot:** in-app suggestion alert.

---

## 17. Community joining and chatting (group + DM)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates |

**Go to:** http://localhost:3000/community?tab=communities then `?tab=chat`

**Steps**

1. Join a community/group.
2. Send a group message.
3. Start a direct message with another user (follow/request if required).
4. Confirm both sides see messages after refresh.

**Expected**

- Join works.
- Group chat and DM both persist.

**Screenshot:** group thread + DM thread.

---

## 18. Multi-channel job posting

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **In progress** |
| Who | Employer |

**Go to:** http://localhost:3001/job → **Add job** (Create Job drawer)

**Steps**

1. Create a job for an internal company (client).
2. Look for posting channels: internal / portal / external platforms / shareable apply link.
3. Copy public apply link if generated (`/apply/{token}`).
4. If LinkedIn/X/Facebook connect is shown, connect or confirm the option exists.
5. Save and reopen the job. Confirm which channels actually published.

**Expected (when complete)**

- Testers can choose internal vs portal vs external vs link.
- Portal/public link works in a logged-out browser: http://localhost:3001/apply/{token} or Phase 1 apply page.

**Screenshot:** create-job channel options + apply link.

---

## 19. Employer / candidate pre-onboarding

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **Not started** |
| Who | Employer |

**Go to:** http://localhost:3001/candidate and http://localhost:3001/pipeline

**Steps**

1. Look for a **pre-onboarding** flow for a candidate (forms, documents, joining checklist **before** placement).
2. If nothing exists beyond normal add-candidate / pipeline, stop.

**Expected today:** feature absent. Mark **Fail / Not started**. Screenshot the candidate page showing no pre-onboarding.

Do not invent a flow.

---

## 20. Landing page pricing removal

| Field | Value |
| --- | --- |
| Category | Both (marketing) |
| Tracker status | Deployed |
| Who | Logged-out visitor |

**Go to:**

- http://localhost:3000/en
- http://localhost:3000/en/employers
- http://localhost:3000/en/services

**Steps**

1. Scroll the full landing and employers pages.
2. Search the page for currency amounts, plan prices, “₹”, “$ / month”, package tables.

**Expected**

- Main landing does **not** show public pricing tables.
- CTAs go to demo / try-free / login instead of a price grid.

**Screenshot:** hero + any section that used to show prices.

---

## 21. Employer landing page (Phase 2 / 3 / 4 roadmap)

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | **Not started** |
| Who | Logged-out visitor |

**Go to:** http://localhost:3000/en/employers

**Steps**

1. Look for a roadmap that clearly labels **Phase 2, Phase 3, Phase 4** features.
2. If only Phase 2 marketing exists with no 3/4 breakdown, record that.

**Expected today:** missing or incomplete. Mark **Fail / Not started** unless you find a real phase roadmap section.

**Screenshot:** employers landing (full page or roadmap area).

---

## 22. Smart suggestions engine (jobs, alerts, LMS, courses)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/candidate-dashboard , http://localhost:3000/lms , http://localhost:3000/en/explore-jobs

**Steps**

1. Confirm AI/smart suggestions appear for **jobs**, **LMS**, and **courses** (not jobs only).
2. Confirm alerts (item 16) can point at those suggestions.
3. Click through one of each type.

**Expected**

- Three suggestion types exist and open the right module.

**Screenshot:** dashboard showing job + LMS/course suggestions.

---

## 23. Company page and social following

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/community → open a company  
Phase 2 company page (employer): http://localhost:3001/company-page

**Steps**

1. Open a company page.
2. Follow the company.
3. Confirm follower count increases.
4. Confirm social follow/links (LinkedIn etc.) if shown.
5. Unfollow and confirm count decreases.

**Expected**

- Follow works and count is visible.

**Screenshot:** company page with follower count and Follow button.

---

## 24. Redis caching for discussions / forum threads

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate + optionally a developer watching Redis |

**Go to:** http://localhost:3000/community (feed / communities / threads)

**Steps**

1. Open a busy community/feed twice in a row. Second load should feel instant if cache is on.
2. Post a new message. Refresh. New post must still appear (cache must not serve stale-only content forever).
3. If you have Redis running locally, ask a developer to confirm keys, **or** note “UI passed; Redis not independently verified”.

**Expected**

- Discussions load; new posts appear.
- Do not fail the item only because you cannot see Redis keys — mark Pass with that note, or Blocked if the team required a Redis proof.

**Screenshot:** thread with a new post after refresh.

---

## 25. Module-wise architecture split (HQ)

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Go to:** http://localhost:3001/hq/login → sidebar

**Steps**

1. Confirm HQ is split into modules, not one mega page:
   - Employees: Dashboard, Candidates, Courses, Portal jobs, Events, Subscriptions, Tickets
   - Employers: Dashboard, Companies, Tenants, Subscriptions, Tickets
   - CRM: Dashboard, Leads, Clients
   - Ops: Team, Reports, Billing, Settings
2. Open one item from each group. Confirm it is its own page.

**Expected**

- Sidebar groups match the modules above.
- Navigation does not dump everything on `/hq` only.

**Screenshot:** full HQ sidebar.

---

## 27. Company page followers tracking (count, list, user-to-user requests)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates |

**Go to:** company page from http://localhost:3000/community

**Steps**

1. Follow a company. Confirm **number** of followers.
2. Open followers **list** if the UI provides it.
3. From a user profile, send a **message request** / follow to another user.
4. Accept on the second account.
5. Confirm you can message after accept.

**Expected**

- Follower count + list (if shipped).
- User-to-user request → accept → message.

**Screenshot:** follower count/list + message request.

---

## 28. AI job recommendation engine (tokens, tags, profile)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Go to:** http://localhost:3000/candidate-dashboard (Job matches)  
http://localhost:3000/en/explore-jobs

**Steps**

1. Note profile tags/skills.
2. Confirm recommended jobs use those tags/metrics (titles/skills overlap).
3. If a recommendation costs coins, confirm the token gate and that a recommendation still appears after unlock.
4. Change a skill on http://localhost:3000/skills or profile, reload recommendations, look for a shift.

**Expected**

- Recommendations track profile/tags, not a static list.
- Token-gated actions are explicit.

**Screenshot:** profile skills beside recommended jobs.

---

## 29. Autosuggest grammar and sentence correction

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Candidate + employer |

**Phase 1:** http://localhost:3000/profile , Become Interviewer text fields, application answers  
**Phase 2:** http://localhost:3001/leads → Add/Edit lead notes, job description fields

**Steps**

1. Type a broken sentence, example: `i has experince in react and python`
2. Wait for the writing-assist tooltip / suggestion.
3. Apply the suggestion.
4. Repeat on one Phase 1 field and one Phase 2 field.

**Expected**

- Grammar/sentence suggestion appears and can be applied.
- It does not block typing.

**Screenshot:** suggestion tooltip on a text field.

---

## 30. Data deduplication engine

| Field | Value |
| --- | --- |
| Category | Both — currently implementing for employers |
| Tracker status | **In progress** |
| Who | Employer |

**Go to:** http://localhost:3001/client and http://localhost:3001/leads  
Add client / add lead with the **same** company name + email as an existing row.

**Steps**

1. Create Client/Lead A with a unique email.
2. Create Client/Lead B with the same email / same company.
3. Confirm duplicate warning, merge prompt, or blocked save.
4. Confirm you cannot get two identical employer records with no warning.

**Expected (when complete)**

- Duplicate employer/lead is detected.

**If the second save succeeds silently:** Fail (in progress). Screenshot both records.

---

## 32. HQ dashboard CRM

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed — improving business stats |
| Who | HQ |

**Go to:** http://localhost:3001/hq/crm-dashboard  
Also: http://localhost:3001/hq/leads and http://localhost:3001/hq/clients

**Steps**

1. Confirm CRM dashboard shows lead/client/company style **business** stats (not only tenant hosting stats).
2. Click through a KPI into leads or clients if the card is clickable.
3. Confirm demo/try-free leads appear if you submitted http://localhost:3000/en/employers/request-demo

**Expected**

- CRM dashboard is usable for sales/ops.
- Stats are specific (leads, conversions, companies), not empty tiles.

**Screenshot:** full CRM dashboard.

---

## 33. System audit logs

| Field | Value |
| --- | --- |
| Category | Both — implementing under employers |
| Tracker status | **In progress** |
| Who | Employer admin |

**Go to:** Phase 2 tables with audit columns (Jobs, Leads, Candidates) — example http://localhost:3001/job  
Settings / activity if present: http://localhost:3001/setting , http://localhost:3001/activity-feed

**Steps**

1. Edit a job or lead.
2. Look at Created / Updated audit cells on the table.
3. Confirm who changed it and when.
4. Look for an admin audit log of logins, deletes, permission changes. If only row-level timestamps exist, say so.

**Expected (when complete)**

- Administrative actions are logged, not only `updatedAt`.

**Screenshot:** table audit columns and any audit/activity page.

---

## 34. Common FAQs + ticket system with HQ

| Field | Value |
| --- | --- |
| Category | Phase 1 (FAQ) + HQ tickets |
| Tracker status | Deployed — FAQ split from help; tickets with HQ |
| Who | Candidate or employer + HQ |

**Public FAQ:** http://localhost:3000/en/faq  
**Help (tickets):** http://localhost:3000/en/help  
**Phase 2 help:** http://localhost:3001/help-center  
**HQ tickets:** http://localhost:3001/hq/tickets?audience=employee and `?audience=employer`

**Steps**

1. Confirm FAQ is its **own** page, not mixed into ticket form only.
2. Raise a ticket from help.
3. Open HQ tickets and find it.
4. Resolve/reply from HQ.
5. Confirm the requester sees the update.

**Expected**

- FAQ ≠ ticket form.
- HQ can see and resolve tickets for employee and employer audiences.

**Screenshot:** FAQ page + HQ ticket list with your ticket.

---

## 35. Employer landing page phase breakdown

| Field | Value |
| --- | --- |
| Category | Phase 2 marketing |
| Tracker status | **Not started** |
| Who | Logged-out visitor |

**Go to:** http://localhost:3000/en/employers and http://localhost:3000/en/services/employers/modules

**Steps**

1. Look for release **phases** and feature lists per phase (same intent as item 21).
2. Record Pass only if phase breakdown is explicit.

**Expected today:** Not started. Screenshot current employers page.

---

## 36. Demo request calendar booking

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Logged-out visitor + HQ |

**Go to:** http://localhost:3000/en/employers/request-demo

**Steps**

1. Fill name, email, company.
2. Pick **date, time, and month** on the calendar/booking control.
3. Submit.
4. In HQ: http://localhost:3001/hq/leads — find the demo lead with that slot.

**Expected**

- Date/time is required and stored.
- HQ lead shows the booked slot.

**Screenshot:** demo calendar picker + HQ lead row.

---

## 37. Freemium conversion (Try Free → paid)

| Field | Value |
| --- | --- |
| Category | Phase 1 candidate coins + employer try-free |
| Tracker status | Deployed |
| Who | HQ + employer (and/or candidate subscriptions) |

**Employer try-free**

1. HQ: http://localhost:3001/hq/leads → grant try-free days to a demo lead.
2. Open http://localhost:3000/en/employers/try-free
3. Log in with the emailed credentials.
4. Land in Phase 2 (http://localhost:3001).
5. Confirm trial limits. After expiry (or HQ shorten to 0), confirm login shows trial ended / request demo — not a silent full product.

**Candidate freemium**

1. http://localhost:3000/subscriptions — free vs premium / coin packs.
2. Use a paid LMS action and confirm paywall then success after coins.

**Expected**

- Try-free is HQ-granted, not an open self-serve full ATS.
- Path to paid/demo is visible after trial.

**Screenshot:** try-free login + Phase 2 session + subscriptions/paywall.

---

## 38. Services (Phase 1 and Phase 2) — guest vs logged-in

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | **Not started** |
| Who | Guest then logged-in user |

**Go to:** http://localhost:3000/en/services  
Phase 2 billing/services: http://localhost:3001/billing (logged in)

**Steps (required behaviour when built)**

1. **Logged out:** open a Phase 1 or Phase 2 service. Must redirect to **demo or login**, not checkout.
2. **Logged in:** same service must show **subscriptions / pay**.

**Expected today:** Not started. Still run the two steps and record what actually happens (example: service page always public, or always asks login).

**Screenshot:** logged-out redirect + logged-in subscription view (or current mismatch).

---

## 39. Headquarters CRM integration

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed — CRM dashboard still being improved |
| Who | HQ |

**Go to:** http://localhost:3001/hq/leads , http://localhost:3001/hq/clients , http://localhost:3001/hq/company , http://localhost:3001/hq/crm-dashboard

**Steps**

1. Submit a demo request (item 36) if you need a fresh inquiry.
2. Confirm it appears as an HQ lead.
3. Convert / move toward client/company if your test account allows.
4. Confirm the CRM dashboard reflects the inquiry.

**Expected**

- Public inquiries are tracked inside HQ CRM, not only in email.

**Screenshot:** new demo lead in HQ Leads + CRM dashboard.

---

## 40. Phase 2 module access control

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | Deployed |
| Who | Tenant admin + a restricted member |

**Go to:** http://localhost:3001/team (roles/permissions)  
http://localhost:3001/setting

**Steps**

1. As admin, create or edit a role **without** Jobs (or Leads) permission.
2. Log in as that member.
3. Confirm **Jobs** (or Leads) is hidden in the sidebar.
4. Manually open http://localhost:3001/job — confirm redirect/denied, not a full table.
5. Restore permission and confirm the module returns.

**Expected**

- Feature gates are real (UI + route), not only a hidden icon.

**Screenshot:** restricted sidebar + denied deep link.

---

## 41. Brand rebranding (remove SAASA B2E)

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Anyone |

**Go to (sample set):**

- http://localhost:3000/en
- http://localhost:3000/en/employers/try-free
- http://localhost:3000/whatsapp
- http://localhost:3001/login
- http://localhost:3001/hq/login
- Browser tab titles, email templates if you trigger one (demo, try-free, OTP)

**Steps**

1. Search visible UI for `SAASA`, `SAASA B2E`, old logos.
2. Check footer, emails, and PDF/export headers if you generate one.
3. Confirm **HRYantra** (or current brand) is used instead.

**Expected**

- No SAASA B2E in product UI, emails, or tester-facing docs you open.
- If one leftover remains (example: an HTML title), mark **Fail** and quote the string.

**Screenshot:** landing header/footer + login + HQ header.

---

## Items not on the tracker

Serials **26** and **31** were missing in the source sheet. Do not invent tests for them.

---

## Results log (copy into the sheet)

| Sr | Pass / Fail / Blocked | Notes | Screenshot file |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |
| 11 | | | |
| 12 | | | |
| 13 | | | |
| 14 | | | |
| 15 | | | |
| 16 | | | |
| 17 | | | |
| 18 | | | |
| 19 | | | |
| 20 | | | |
| 21 | | | |
| 22 | | | |
| 23 | | | |
| 24 | | | |
| 25 | | | |
| 27 | | | |
| 28 | | | |
| 29 | | | |
| 30 | | | |
| 32 | | | |
| 33 | | | |
| 34 | | | |
| 35 | | | |
| 36 | | | |
| 37 | | | |
| 38 | | | |
| 39 | | | |
| 40 | | | |
| 41 | | | |

**Suggested test order:** 20 → 41 → 1 → 36 → 37 → 7 → 4 → 2 → 5 → 6 → 8 → 9 → 17 → 23 → 27 → 11 → 15 → 16 → 12 → 13 → 22 → 28 → 29 → 34 → 3 → 18 → 10 → 30 → 33 → 40 → 14 → 25 → 32 → 39 → 19 → 21 → 35 → 38 → 24.
