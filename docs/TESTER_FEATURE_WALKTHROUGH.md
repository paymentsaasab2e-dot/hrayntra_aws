# HRYantra tester walkthrough

Give this file to the tester. Work **one serial number at a time**. Follow the **click path** exactly: open the page, look where the control sits (top bar, left sidebar, bottom bar, top-right), then click the named button.

For each item: mark **Pass / Fail / Blocked**, paste a screenshot into **SCREEN SHOT**, and write a one-line note.

**Environment:** local only.

| App | URL | Typical API |
| --- | --- | --- |
| Phase 1 candidate portal | http://localhost:3000 | http://localhost:5000 |
| Phase 2 employer ATS | http://localhost:3001 | http://localhost:5001 |
| Headquarters | http://localhost:3001/hq | same Phase 2 API |

English marketing pages use `/en/` (example: http://localhost:3000/en/employers). If a link 404s, add `/en` after the host.

**Accounts (ask the team for live passwords):**

| Role | Start URL | Identifier |
| --- | --- | --- |
| Candidate | http://localhost:3000/whatsapp | WhatsApp + country code, or email |
| Employer / tenant | http://localhost:3001/login | tenant login ID + password |
| HQ | http://localhost:3001/hq/login | `admin@gmail.com` + HQ password |

---

## How to read a click path

Every step is written as: **where to look** → **what to click**.

Example:

> Top-right of the white header → blue pill **Log In** → login form → blue **Log in** at the bottom of the form.

Bold names are the **exact button / tab labels** on screen.

---

## Where buttons live (memorize this first)

### Phase 1 — guest (not logged in)

Open http://localhost:3000/en

- **Top bar, left:** logo (home)
- **Top bar, center:** **Employee** | **Courses** | **Businesses** | **Entrepreneurs**
- **Top bar, right:** blue pill **Log In**
- On **Entrepreneurs** pages only, **top-right, left of Log In:** orange pill **Try it free**

**Log In** opens candidate WhatsApp login: http://localhost:3000/whatsapp

### Phase 1 — after candidate login

Top white header:

- **Left / center links:** **Dashboard** | **Jobs** | **Applications** | **LMS** | **Profile** | **Businesses** (opens in a new tab)
- **Top-right:** notification **bell**, then **profile photo / avatar**
- Click the **avatar** → menu → **Office Gossips** (community), **Subscriptions**, settings, logout

**LMS** opens Learning Hub. Then use the **LMS left sidebar:**

- **Courses**
- **Interview Prep**
- **Quizzes**
- **Notes**
- **Career Path**

**Office Gossips** has a **fixed bar at the bottom of the screen:**

- **Chat** | **Communities** | **Feed** | **Events**

### Phase 2 — employer login

Open http://localhost:3001/login

- Center card titled **Log in**
- Fields: login ID / email, password (eye icon on the right of password)
- Bottom of card: **Log in**

After login, **dark left sidebar:**

- Hover **CRM** → **Leads** | **Clients** | **Dashboard**
- Hover **Recruitment** → **Jobs** | **Candidates** | **Pipeline** | **Matches** | **Interviews** | **Placements** | **Dashboard**
- Lower items: **Tasks & Activities** | **Portal Events** | **Inbox** | **Billing** | **Team** | **Settings**

**Top bar (dark, right side):** calendar **icon** (tooltip Calendar) | coin balance | help icon | profile

### HQ login

Open http://localhost:3001/hq/login

- Email is locked to HQ
- Password field
- Bottom: **Sign in to HQ**

After login, **left HQ sidebar groups:**

- **Employees:** Dashboard, Candidates, Courses, Portal jobs, Events, Subscriptions, Tickets
- **Employers:** Dashboard, Companies, Tenants, Subscriptions, Tickets
- **CRM:** Dashboard, Leads, Clients
- **Ops:** Team, Reports, Billing, Settings

---

## Standard logins (use these before each role’s tests)

### A. Candidate login

1. Open http://localhost:3000/en
2. Top-right → **Log In**
3. On WhatsApp page: if you see **Sign up**, switch to **Sign in** (toggle on the form).
4. Choose **WhatsApp** or **Email** (small icons above the fields).
5. Country-code dropdown is **left of the phone box**.
6. Fill number/email + password or OTP.
7. Click the main submit button at the **bottom of the form** (Send OTP / Sign in / Continue).
8. After success you land on **Dashboard**.

### B. Employer login

1. Open http://localhost:3001/login
2. Type login ID and password in the center card.
3. Click **Log in** at the bottom of the card.
4. You land on the employer workspace (sidebar on the left).

### C. HQ login

1. Open http://localhost:3001/hq/login
2. Type HQ password.
3. Click **Sign in to HQ**.
4. You land on HQ with the left module sidebar.

---

## Before you start

1. Phase 1 frontend + `backend1` running.
2. Phase 2 frontend + `backendphase2` running.
3. Two browsers (or one incognito) so candidate / employer / HQ sessions do not clash.
4. Screenshot folder: `Sr01`, `Sr02`, …

---

## 1. Auto-fetch country code

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate (logged out) |

**Click path**

1. Open http://localhost:3000/en
2. Top-right → **Log In**
3. You are on the WhatsApp login card. **Do not type yet.**
4. Look **left of the phone number box** — the country-code dropdown (flag + dial code, example +91).
5. Confirm it is already filled from timezone/browser (not empty).
6. Click that dropdown and pick another country, then pick the original back — it must be changeable.
7. On the same card, switch **Sign in** ↔ **Create account / Sign up** (toggle at the top of the form). Confirm the country dropdown still auto-fills.

**Expected:** country code is pre-selected; flag matches dial code.

**Screenshot:** login card with the country dropdown visible before typing.

---

## 2. Mock interview skill matching (interviewer + candidate + reports)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed — reports still being implemented |
| Who | Candidate A (interviewer), Candidate B (seeker) |

### Module 1 — Become an interviewer (Candidate A)

**Click path**

1. Do **Candidate login (A)**.
2. Top header → **LMS**.
3. LMS **left sidebar** → **Interview Prep**.
4. On Interview Prep, the **Roles** tab is selected by default (row of pills under the title: **Roles** | **Practice** | **Forms**). Stay on **Roles**.
5. You see three cards. Middle/right card titled **Become Interviewer**.
6. On that card click **Unlock** (costs coins) or, if already unlocked, **Open interviewer page**.
7. You are now on **Become an Interviewer**. Fill skills, experience, charges, available days/slots (scroll the form).
8. Bottom of the form → **Submit Interviewer Application**.
9. After submit, stay on the same page. Use the **tabs at the top of this page** (requests / queue).
10. On a request row, right side → **Accept**. On another row → **Reject**.
11. After Accept, click the join/room button on that row (opens live/candidate-interviewer room).
12. After the session, submit **feedback** on that request.
13. Look for earnings / completed / ratings tabs on the same interviewer page.

**Expected:** application saves; Accept/Reject work; room opens; feedback saves. If a reports tab is missing, mark Fail “report UI missing”.

### Module 2 — Candidate books a mock (Candidate B)

**Click path**

1. Other browser → **Candidate login (B)**.
2. Top header → **LMS** → left sidebar → **Interview Prep**.
3. **Roles** tab → left card **Be Interviewed** → blue **Request interview**.
4. On the request page, use **filters** at the top (technology / experience / rating / price) if shown.
5. Click an interviewer **name / card** to open the profile.
6. Click **Send request** / **Book** → pick a **time slot** on the calendar.
7. If coins/pay appear, click **Pay** / **Unlock** / confirm.
8. After booking, open the request again → **Join** (candidate room).
9. After the interview, open **feedback report** and click stars to **Rate**.

**Matching to confirm:** slot selected → pay/unlock → slot disappears for others → room exists → feedback exists.

**Screenshot:** Become Interviewer form, Request interview booking, one history/report screen.

---

## 3. Interview prep schedule — per-person calendar + conflict alert

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | Deployed |
| Who | Employer recruiter |

**Click path**

1. Do **Employer login**.
2. **Top bar, right**, calendar icon (tooltip **Calendar**) → click it.  
   Or left sidebar if Calendar is listed.
3. Page title is the calendar. **Top-right of the page**, dropdown **My calendar**.
4. Click that dropdown → search/select a **teammate**, then select **all** if offered.
5. Confirm the month grid changes per person.
6. Left sidebar → hover **Recruitment** → **Interviews**.
7. **Top-right of Interviews** → blue **Schedule interview**.
8. In the modal: pick a candidate, pick an interviewer/panel member, pick a **date/time that person already has**.
9. Click **Save** / **Schedule**. A conflict alert must appear (do not ignore it).
10. Change to a **free** slot → Save. Open Calendar again, select that person, confirm the new interview is on their grid.

**Expected:** per-user calendar; double-book alert; saved interview on that user’s calendar.

**Screenshot:** calendar person dropdown + conflict alert.

---

## 4. Course recommendations (Udemy / Academy / Coursera / YouTube in container)

| Field | Value |
| --- | --- |
| Category | Phase 1 + HQ publish |
| Tracker status | Deployed — UI still being improved |
| Who | HQ then candidate |

**HQ — publish**

1. Do **HQ login**.
2. Left sidebar, **Employees** group → **Courses**.
3. **Top-right of the Courses page** → **Create course**.
4. Fill the modal (title, category, thumbnail/video).
5. Near the bottom of the modal, tick **Published**.
6. Click **Create course** (bottom-right of the modal).
7. In the table, the row must show badge **Published** (not Draft).

**Candidate — consume**

1. Do **Candidate login**.
2. Top header → **Dashboard**.
3. Scroll to **Recommended courses** panel → click a course card.
4. Also: top header → **LMS** → left sidebar → **Courses** → open the HQ course.
5. If the suggestion is YouTube, the player must be **inside the page**, not only “open in YouTube”.

**Screenshot:** HQ Create course modal (Published ticked) + candidate recommendation + in-page video.

---

## 5. Interviewer eligibility — KYC verified tag

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | **In progress** |
| Who | Candidate |

**Click path**

1. Do **Candidate login**.
2. Top header → **LMS** → **Interview Prep** → **Roles** → **Become Interviewer** card → **Unlock** / **Open interviewer page**.
3. Try **Submit Interviewer Application** with no KYC. Note if it blocks you.
4. Top header → **Profile**. Complete KYC / verification fields if shown. Save.
5. Go back: **LMS** → **Interview Prep** → **Open interviewer page**.
6. Look next to the title / badge area for **KYC verified** or **Verified**.

**If there is no KYC gate and no verified tag:** Fail (in progress). Screenshot the Become Interviewer header.

---

## 6. Events portal and application (Office Gossips Events)

| Field | Value |
| --- | --- |
| Category | Phase 1 (events from HQ / employer) |
| Tracker status | Deployed — HQ/employer integration still being checked |
| Who | HQ or employer + candidate |

**HQ create**

1. **HQ login** → left sidebar **Employees** → **Events**.
2. Top of page → **Create** / **Add event** (primary button, top-right).
3. Fill title, date, save/publish.

**Employer create**

1. **Employer login** → left sidebar → **Portal Events**.
2. Top-right → create/add event if shown.

**Candidate apply**

1. **Candidate login**.
2. Top-right **avatar** → **Office Gossips**.
3. **Bottom bar** → **Events**.
4. Click an event card in the list.
5. On the event detail, click **Apply** / **Register**.
6. Confirm toast or “registered”.

**Screenshot:** HQ/employer create button + candidate bottom **Events** + Apply success.

---

## 7. Personalized job feed

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. **Candidate login**.
2. Top header → **Profile**. Complete skills. Save.
3. If asked to upload CV: use **Upload CV** / resume control on Profile or go to upload-cv after login.
4. Top header → **Jobs**. Open a job card → **Apply**. Repeat for a second job.
5. Top header → **Dashboard**.
6. Find **Job matches** / recommended jobs panel (main column, not the far footer).
7. Confirm those jobs match the profile skills (not only “latest”).
8. On a recommendation card click **Apply**.
9. Top header → **Applications** — the new apply must appear.

**Screenshot:** Dashboard job matches next to Profile skills.

---

## 8. Community reviews / BGV reference check

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates |

**Click path**

1. Candidate A login → avatar → **Office Gossips**.
2. Bottom bar → **Feed** or **Communities**. Search/open a **company** or **user**.
3. On that page click **Reference check** / **Request reference** / **Review**.
4. Send the request.
5. Candidate B (other browser): avatar → **Office Gossips** → bottom **Chat** (or notifications **bell**, top-right).
6. Open the request → **Accept**. Complete the form → **Submit**.
7. Back on A: open the same profile and confirm the review/reference result is visible.

**Screenshot:** request button + accepted/completed review.

---

## 9. LMS / community flow (search, request, accept, chat, paid reference)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed — end-to-end still to be tested |
| Who | Two candidates |

**Click path**

1. Candidate A: avatar → **Office Gossips**.
2. Bottom bar → **Communities**. Use the **search box at the top** of the page. Type a company name. Click the result.
3. On the company page click **Follow** or **Message** / **Send request**.
4. Candidate B: **bell** (top-right) or Office Gossips bottom **Chat** → **Accept**.
5. Both users: bottom **Chat** → open the thread → send a message.
6. If a **Call** icon is on the chat header, click it (or note that it exists).
7. For paid reference: on the company/user page click **Reference check**. If coins are required, confirm the paywall, then **Unlock** / pay, then chat still works.
8. Bottom **Feed** → create a post if the composer is at the top. Bottom **Communities** → **Join** on a circle.

**Screenshot:** search result, Accept, Chat thread.

---

## 10. Company verification checks

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **In progress** |
| Who | Employer + HQ |

**Click path**

1. **Employer login**.
2. Left sidebar hover **CRM** → **Clients**.
3. Top-right → **Add client** / **+** (same pattern as other modules).
4. Fill company, website, LinkedIn. Look for GST / verification fields.
5. Click **Save**. Try a fake GST → expect an error under the field.
6. Open the saved client drawer. Look for verification badges (website, LinkedIn, social, reviews, BGV).
7. Also check left sidebar **Settings** for org tax/GST.
8. Optional HQ: sidebar **Employers** → **Companies** — same verification fields.

**If Save works with no checks:** Fail (in progress). Screenshot the form.

---

## 11. Points-based gamification + refer-a-friend token

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. **Candidate login** → **Dashboard**.
2. Note coin/points (often top-right near the avatar, or **Pending earn** card on the dashboard).
3. Avatar menu → **Subscriptions**.
4. Tabs at the top of that page: **Premium** | **Earn**. Click **Earn**. Do one task (click the task row / **Go**).
5. Return to Dashboard. Confirm balance went up (celebration may appear in the center of the screen).
6. On Subscriptions / Dashboard / Profile find **Refer a friend** / invite **token**. Click **Copy**.
7. Other browser: candidate signup. Paste token if a field exists. Complete signup.
8. Back on A: confirm reward or pending reward.

**Screenshot:** coin balance before/after + referral token.

---

## 12. Post-rejection subscription flow

| Field | Value |
| --- | --- |
| Category | Phase 1 + HQ |
| Tracker status | Deployed |
| Who | Candidate + HQ |

**Click path**

1. Candidate: header **Jobs** → open several jobs → **Apply**.
2. Employer browser: **Recruitment** → **Jobs** → click the job row → **Pipeline** / candidates tab → on the candidate → **Reject**.
3. Repeat until the candidate has several rejections.
4. Candidate: **bell** (top-right). Open a rejection / subscription notification.
5. If a banner appears, click **View plans** / it should go to Subscriptions. Avatar → **Subscriptions**.
6. HQ: **Sign in to HQ** → left **Employees** → **Dashboard**. Look for a sales/behaviour **flag** on that user (or Candidates list).

**Screenshot:** candidate bell/prompt + HQ flag.

---

## 13. Dashboard suggestions customization (LMS)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. **Dashboard**. Screenshot the LMS/course suggestion cards.
2. Header **LMS** → **Courses** → open a course → **Enroll** / **Start** if shown.
3. Header **Dashboard** again (refresh).
4. Confirm suggestion cards **changed**.

**Screenshot:** dashboard before and after.

---

## 14. Phase 1 and Phase 2 subscriptions at HQ dashboard

| Field | Value |
| --- | --- |
| Category | Both / HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ login**.
2. Left **Employees** → **Dashboard**. Confirm Phase 1 / employee subscription stats.
3. Left **Employers** → **Dashboard**. Confirm Phase 2 / tenant plan stats.
4. Left **Employees** → **Subscriptions** (coin packs).
5. Left **Employers** → **Subscriptions** (or **Tenants** then plans) / **Ops** → **Billing**.

**Screenshot:** both dashboards + both subscription screens.

---

## 15. Activity notification system

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. Logged in. Trigger activity (Apply on **Jobs**, or a community request).
2. **Top-right bell** → click it. Tray opens.
3. Click the newest row. You must land on the related page.
4. In the tray click **Mark read** / **Mark all read** if shown.

**Screenshot:** open bell tray.

---

## 16. Activity and suggestion alerts (in-app / push)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. Stay on **Dashboard** after login.
2. Wait or browse **Jobs**. An in-app **toast / floating card** should appear (not only the bell).
3. Click the alert CTA (example **View job** / **View course**).
4. If the browser asks for notification permission, click **Allow**. If it never asks, note “in-app only”.

**Screenshot:** floating/toast alert on Dashboard.

---

## 17. Community joining and chatting (group + DM)

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates |

**Click path**

1. Avatar → **Office Gossips**.
2. Bottom bar → **Communities**.
3. Click a circle → **Join**.
4. Open that community → type in the message box at the **bottom of the thread** → send.
5. Bottom bar → **Chat**. Start a **DM** (user row / search). If it says request, send it.
6. Other account: **Chat** → **Accept** → reply.
7. Refresh both. Messages must still be there.

**Screenshot:** Join + group message + DM.

---

## 18. Multi-channel job posting

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **In progress** |
| Who | Employer |

**Click path**

1. **Employer login** → hover **Recruitment** → **Jobs**.
2. Top of Jobs page → **Create Manually** (or **Create with AI** then switch to manual).
3. Create Job **drawer slides in from the right**.
4. Select **Client / company**. Fill title and description.
5. Scroll to posting channels: internal / portal / external / LinkedIn / copy **apply link**.
6. Click **Save** / **Create job** at the **bottom of the drawer**.
7. Reopen the job (click the row). Confirm which channels published.
8. Copy apply link. Incognito: open the link. Confirm the public apply page.

**Screenshot:** drawer channel options + apply link.

---

## 19. Employer / candidate pre-onboarding

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | **Not started** |
| Who | Employer |

**Click path**

1. **Recruitment** → **Candidates**. Top-right add button if any. Open a candidate **drawer**.
2. Look through tabs for **Pre-onboarding** / joining checklist **before** placement.
3. **Recruitment** → **Pipeline** — same check.

**Expected today:** not there. Fail / Not started. Screenshot the candidate drawer tabs.

---

## 20. Landing page pricing removal

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Logged out |

**Click path**

1. Open http://localhost:3000/en — **do not log in**.
2. Scroll the full page. Top bar should show **Log In**, not a price table.
3. Top bar → **Entrepreneurs**. Scroll. Top-right **Try it free** and **Log In** are OK. No ₹ / $ /month grid.
4. Top bar → **Businesses**. Same check.

**Screenshot:** landing hero + employers hero (no prices).

---

## 21. Employer landing page (Phase 2 / 3 / 4 roadmap)

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | **Not started** |
| Who | Logged out |

**Click path**

1. http://localhost:3000/en → top bar **Entrepreneurs**.
2. Scroll looking for headings **Phase 2**, **Phase 3**, **Phase 4**.
3. If missing, Fail / Not started.

**Screenshot:** employers landing.

---

## 22. Smart suggestions engine

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. **Dashboard**. Confirm suggestion cards for **jobs**, **LMS/courses** (and alerts).
2. Click a **job** suggestion.
3. Click a **course** suggestion (or header **LMS** → a recommended course).
4. Confirm an alert (item 16) can open one of these.

**Screenshot:** Dashboard with more than one suggestion type.

---

## 23. Company page and social following

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. Avatar → **Office Gossips** → bottom **Feed** or search a company.
2. Open the **company page**.
3. Click **Follow** (usually near the company name, top of the page).
4. Note follower **count** next to Follow.
5. Click **Follow** again to unfollow; count must drop.
6. Employer optional: left sidebar / company page at http://localhost:3001/company-page.

**Screenshot:** Follow button + count.

---

## 24. Redis caching for discussions

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. Avatar → **Office Gossips** → bottom **Communities** → open a busy circle.
2. Open it twice. Second open should be fast.
3. Type a post/comment at the **bottom composer** → send.
4. Refresh. The new post must still show.

**Screenshot:** thread with the new post.

---

## 25. Module-wise architecture split (HQ)

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ login**.
2. Look at the **left sidebar only**. Do not use the URL bar.
3. Click **Employees → Candidates**, then **Courses**, then **Events**.
4. Click **Employers → Companies**, then **Tenants**.
5. Click **CRM → Leads**, then **Clients**, then CRM **Dashboard**.
6. Click **Ops → Team**, **Reports**, **Settings**.

Each click must change the main page. Screenshot the **full sidebar**.

---

## 27. Company page followers tracking + user requests

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Two candidates |

**Click path**

1. Open a company page (item 23). Click **Follow**. Confirm **count**.
2. Click the count / **Followers** to open the **list** if it exists.
3. Open another **user** profile (from Feed or Chat). Click **Follow** or **Message request**.
4. Other account: **Chat** or **bell** → **Accept**.
5. Chat must open.

**Screenshot:** follower list + accept request.

---

## 28. AI job recommendation engine

| Field | Value |
| --- | --- |
| Category | Phase 1 |
| Tracker status | Deployed |
| Who | Candidate |

**Click path**

1. Header **Profile** — note skills/tags.
2. Header **Dashboard** — **Job matches**.
3. If a card shows a coin/lock, click **Unlock** and confirm the job still shows.
4. Profile → edit a skill → **Save**.
5. Dashboard again — recommendations should shift.

**Screenshot:** Profile skills beside Job matches.

---

## 29. Autosuggest grammar and sentence correction

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Candidate + employer |

**Phase 1**

1. Header **Profile**. Click a text/textarea (About / summary).
2. Type: `i has experince in react and python`
3. Wait. A **suggestion tooltip** appears near the field. Click it to apply.

**Phase 2**

1. **Employer login** → **CRM** → **Leads**.
2. Click a lead row (drawer from the right) → **Edit**.
3. In **Notes** (or any long text), type the same broken sentence. Apply the tooltip.
4. Optional: **Jobs** → Create Manually → job description field — same tooltip.

**Screenshot:** tooltip on the field.

---

## 30. Data deduplication engine

| Field | Value |
| --- | --- |
| Category | Both — employers in progress |
| Tracker status | **In progress** |
| Who | Employer |

**Click path**

1. **CRM** → **Leads** → top **Add Lead**. Create company+email A. Save.
2. **Add Lead** again with the **same email**. Click Save.
3. Expect a duplicate warning (do not get a silent second lead).
4. **CRM** → **Clients** → add client with the same company/email. Same check.

**If both save with no warning:** Fail. Screenshot both rows.

---

## 32. HQ dashboard CRM

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ login** → left **CRM** → **Dashboard** (not Employees Dashboard).
2. Read KPI cards (leads, clients, companies — business numbers).
3. Click a KPI if it is clickable.
4. Left **CRM** → **Leads**. Confirm demo leads exist (or create via item 36 first).

**Screenshot:** CRM dashboard full page.

---

## 33. System audit logs

| Field | Value |
| --- | --- |
| Category | Both — employers in progress |
| Tracker status | **In progress** |
| Who | Employer admin |

**Click path**

1. **Recruitment** → **Jobs**. Open a job → **Edit** → change title → **Save**.
2. Back on the table, look at **Created / Updated** columns on the **right side** of the row (audit cells).
3. Repeat on **CRM** → **Leads**.
4. Left sidebar → **Settings**. Look for audit / activity.
5. If there is **Activity feed** in the menu, open it and find your edit.

**Screenshot:** audit columns + any activity page.

---

## 34. Common FAQs + ticket system with HQ

| Field | Value |
| --- | --- |
| Category | Phase 1 + HQ |
| Tracker status | Deployed |
| Who | Candidate/employer + HQ |

**Click path**

1. Logged out: http://localhost:3000/en/faq — FAQ list only (no ticket form mixed in as the whole page).
2. http://localhost:3000/en/help — fill the **ticket form** → **Submit**.
3. Employer: after login, **top-right help icon** (tooltip Help Center) → http://localhost:3001/help-center → submit a ticket.
4. **HQ login** → **Employees** → **Tickets**. Find the Phase 1 ticket. Open it → reply / **Resolve**.
5. Switch HQ tickets to **Employers** (sidebar **Employers** → **Tickets**, or `audience=employer`) and find the employer ticket.

**Screenshot:** FAQ page + HQ ticket row.

---

## 35. Employer landing page phase breakdown

| Field | Value |
| --- | --- |
| Category | Phase 2 marketing |
| Tracker status | **Not started** |
| Who | Logged out |

**Click path**

1. Top bar **Entrepreneurs**.
2. Scroll for phase-by-phase feature lists.
3. Open http://localhost:3000/en/services/employers/modules if linked from Businesses.

**Expected today:** Not started. Screenshot the page.

---

## 36. Demo request calendar booking

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Guest + HQ |

**Click path**

1. http://localhost:3000/en → **Entrepreneurs**.
2. Find **Request demo** / **Book a demo** (hero or later section) and click it.  
   Direct: http://localhost:3000/en/employers/request-demo
3. Fill name, email, company.
4. Click the **calendar** (month) → pick a **date** → pick a **time**.
5. Bottom → **Submit** / **Book**.
6. **HQ login** → **CRM** → **Leads**. Find that name. Open the row. Confirm date/time.

**Screenshot:** calendar picker + HQ lead.

---

## 37. Freemium conversion (Try Free → paid)

| Field | Value |
| --- | --- |
| Category | Phase 1 coins + employer try-free |
| Tracker status | Deployed |
| Who | HQ + employer / candidate |

**Employer**

1. Complete item 36 so a demo lead exists.
2. HQ → **CRM** → **Leads** → on the demo row, click **Grant try-free** (person/gift control on the right of the row).
3. Set days, password if asked → confirm / send.
4. Logged out: **Entrepreneurs** → top-right orange **Try it free**.
5. Enter the emailed login → submit.
6. You should land on Phase 2 (localhost:3001).
7. After trial ends (or HQ sets 0 days), employer **Log in** should show trial ended / request demo — not full ATS.

**Candidate**

1. Avatar → **Subscriptions** → **Premium** / buy a pack.
2. **LMS** → **Interview Prep** → **Become Interviewer** → **Unlock** (coin spend). Confirm paywall then success.

**Screenshot:** Grant try-free modal + Try it free login + Subscriptions.

---

## 38. Services — guest vs logged-in

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | **Not started** |
| Who | Guest then logged-in |

**Click path**

1. Logged **out**: top bar **Businesses**. Click a service card (Interview prep, courses, etc.).
2. Must go to **Log In** or **Request demo** — not a pay checkout.
3. **Candidate login**. Open **Businesses** again (new tab). Same card should show **Subscriptions / Pay**.
4. Employer: **Log in** → left **Billing**. Confirm pay/plans if this is the Phase 2 services screen.

**Record what actually happens.** Screenshot both states.

---

## 39. Headquarters CRM integration

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. Run item 36 (submit demo).
2. HQ → **CRM** → **Leads** — the inquiry is a row. Click it (drawer).
3. If convert is available, use **Convert** / move to client.
4. **CRM** → **Clients** and **Employers** → **Companies** as needed.
5. **CRM** → **Dashboard** — the new inquiry is reflected in stats.

**Screenshot:** new lead drawer + CRM dashboard.

---

## 40. Phase 2 module access control

| Field | Value |
| --- | --- |
| Category | Phase 2 |
| Tracker status | Deployed |
| Who | Admin + restricted member |

**Click path**

1. Admin **Employer login** → left **Team**.
2. Open **Roles** tab (top of Team page). Edit a role. **Untick Jobs** (or Leads). Save.
3. **Members** tab → assign that role to a test user.
4. Log out (profile menu, top-right).
5. Log in as that member.
6. Left sidebar: hover **Recruitment** — **Jobs** must be **missing**.
7. In the address bar open http://localhost:3001/job — must be denied/redirect, not the jobs table.
8. Admin restores the tick. Member refreshes. **Jobs** returns.

**Screenshot:** role checkboxes + member sidebar without Jobs.

---

## 41. Brand rebranding (remove SAASA B2E)

| Field | Value |
| --- | --- |
| Category | Both |
| Tracker status | Deployed |
| Who | Anyone |

**Click path**

1. http://localhost:3000/en — header logo + footer. Search the page for `SAASA`.
2. **Entrepreneurs** → **Try it free** — same search (title, heading, button).
3. **Log In** (WhatsApp page) — logo and headings.
4. http://localhost:3001/login — **Log in** card.
5. http://localhost:3001/hq/login — **Sign in to HQ**.
6. Trigger one email (OTP or demo). Open the email. No SAASA B2E.

**Expected:** HRYantra (or current brand) only. Quote any leftover string as Fail.

**Screenshot:** landing header/footer + both logins.

---

# Sheet 2 — CRM / Leads (Phase 2 + HQ)

These 10 rows are a **second tracker**. Number them **CRM-1** to **CRM-10** in notes so they do not clash with sheet 1.

All CRM tests start with **Employer login** unless the row says HQ.

---

## CRM-1. Lead page — shareable link so another team member can fill leads

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer admin + a second person (email inbox) |

**Click path**

1. **Employer login**.
2. Left sidebar → hover **CRM** → click **Leads**.
3. Under the page header (blue strip, **above the summary cards**), find **Public lead form link**.
4. The long URL is in the read-only box. To the **right of that box**:
   - Blue **Share**
   - Person **icon** (tooltip **People with access**)
5. Click **Share**. A popup opens.
6. Fill **Name**, **Designation**, **Gmail/email**, **Password** (eye icon on the right of password). Password must be at least 8 characters.
7. Click the confirm/send button at the **bottom of the popup**.
8. The other person receives an email with the form URL + login. Open that URL (example `/lead-form/{token}?tenantDbName=…`).
9. They **log in** on that page, then click **Add Lead**, fill the form, save.
10. Back on **Leads**, click the person **icon**. Popup **People with access** must list them and a lead count.
11. Same **Share** + person icon also appear inside **Add Lead** (top of the drawer, blue strip) after you click **Create Manually**.

**Expected:** member is created, email goes out, they can add a lead from the external form, access popup shows them.

**Screenshot:** Leads blue strip with **Share** + person icon, share popup, access popup.

---

## CRM-2. Lead drawer — phone number validation

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads**.
2. Top-right of the header → **Create Manually** (or **Create with AI** then continue to the form).
3. Drawer opens from the **right**. Go to the **Contacts** step (wizard steps at the top of the drawer).
4. Set **Country** first (location field), then type a **wrong** phone (too short, letters, or wrong length for that country).
5. Click **Next** / **Create**. A red error must appear **under the phone field** (example: enter a valid mobile number).
6. Type a valid number for that country (India: 10 digits after country code). Error must clear. Save must work.
7. Open an existing lead row → **Edit** (pencil on the row, or **Edit** in the drawer header). Change phone to invalid → **Save**. Same error.

**Expected:** invalid numbers are blocked; valid numbers save. Country code on the left of the phone must match the country.

**Screenshot:** red validation under the phone field.

---

## CRM-3. Company name + company email

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | **On Hold** |
| Who | Employer |

**Click path**

1. **CRM** → **Leads** → **Create Manually**.
2. On the **Company** step, confirm **Company name** is required.
3. Look for a **company email** field that is separate from **Director / contact email** (Contacts step).
4. If company email is missing or still the same as director email, record **On Hold / Fail** — do not invent a field.

**Expected today:** On Hold. Screenshot the Company + Contacts steps showing what emails exist.

---

## CRM-4. Multi-select industry in the lead drawer

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads** → **Create Manually**.
2. **Company** step. Find label **Industry**.
3. Click the industry box. Type `technology`. Click a suggestion chip. A **tag** appears in the box.
4. Type a second industry (example `healthcare`). Click it. **Two tags** must stay.
5. Click the **X** on one tag to remove it.
6. Press **Enter** to add a custom industry if prompted (helper text under the field).
7. Create the lead. Reopen it. Both industries must still show.
8. Repeat in **Edit** mode on an existing lead.

**Expected:** more than one industry can be selected; tags save.

**Screenshot:** Industry box with two tags.

---

## CRM-5. Next follow-up — Call / WhatsApp / Meet / Email (button look) + meet extras

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads** → **Create Manually**. Fill company + contacts (include a phone and an email).
2. Wizard step **Follow-up & Assignment** (or open an existing lead → tab **Follow-up**).
3. Section **Follow-up via** — these must look like **buttons** (not a plain dropdown): **Call** | **WhatsApp** | **Email** | **Meet** | **Other**.
4. Click **Call**. Under **Choose number**, phone chips appear as buttons. Click one.
5. Click **WhatsApp**. Same number chips. Label should say **Choose WhatsApp number**.
6. Click **Email**. Email chips appear. Click one.
7. Click **Meet**. Extra block appears:
   - **Meet link** (paste Google Meet / Zoom / Teams URL)
   - **Who will join the meet** — multi-select people (search and tick more than one teammate)
8. **Date & time** picker — set a future slot.
9. **Reminder** — button chips (None / 15 min / etc.). Click one.
10. **Timezone** — dropdown (default often Asia/Kolkata). Change it.
11. Save / create the lead. Reopen **Follow-up** tab. Values must still be there.

**Expected:** types are buttons; Call/WhatsApp pick a number; Email picks an email; Meet has link + multi-select attendees; reminder + timezone save.

**Screenshot:** Follow-up via buttons + Meet link + attendees + reminder chips.

---

## CRM-6. Recently activity should come first (CRM — Leads, Clients, Dashboard)

| Field | Value |
| --- | --- |
| Category | Phase 2 CRM |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads**. Open a lead → tab **Activities**. The **top** row must be the **newest** action (not oldest first). Add a note or follow-up, refresh, it jumps to the top.
2. Close. **CRM** → **Clients**. Open a client → **Activities** (or equivalent log). Newest first.
3. Left sidebar **CRM** → **Dashboard**. Find the **activity timeline** / recent activity panel. Newest items at the top.
4. On **Leads** and **Clients** tables, after you edit a record, that row should move up by recent activity / updated time (or the activity feed on Dashboard shows it first).

**Expected:** newest activity is first on lead, client, and CRM dashboard.

**Screenshot:** Activities tab with latest entry at the top + CRM dashboard timeline.

---

## CRM-7. Job link — share to WhatsApp and other platforms (icons)

| Field | Value |
| --- | --- |
| Category | Phase 2 Jobs |
| Tracker status | Deployed |
| Who | Employer (+ optional logged-out browser) |

**Click path**

1. Left sidebar → hover **Recruitment** → **Jobs**.
2. Click a job **row**. Drawer opens from the right.
3. Under the job title, green box **Candidate apply link**.
4. Click **Copy** (copies the URL).
5. Click **Share** (to the right of Copy). A **Share via** menu drops down with: **WhatsApp**, **LinkedIn**, **X / Twitter**, **Facebook**, **Telegram**, **Email**.
6. Click **WhatsApp** — a WhatsApp window/tab must open with the job text + link.
7. Click the others one by one (or note each icon/label). **Copy link** may also be in the menu.
8. Optional: open the apply URL in incognito. On the **right edge of the screen**, a vertical **Share** rail of **icons** (Facebook, X, Email, LinkedIn, WhatsApp, Gmail, Telegram, WeChat). Click WhatsApp and Copy.

**Expected:** share uses **icons/labels**, not a raw URL only. WhatsApp and other platforms work.

**Screenshot:** Share via menu in the job drawer + public page share rail.

---

## CRM-8. HQ — each service has its own price (sales adds in CRM)

| Field | Value |
| --- | --- |
| Category | HQ CRM |
| Tracker status | Deployed |
| Who | HQ sales |

**Click path**

1. **HQ login**.
2. Left **CRM** → **Leads**. Open a lead (or create one). Look for **Services needed** / interested modules. Sales should be able to set commercial fields.
3. Left **CRM** → **Clients** (or **Employers** → **Companies**).
4. Top-right → **Add** / **Create company**.
5. Fill company + contact. Scroll to commercial fields:
   - **Expected users**
   - **Price per user** (sales types this)
   - **Billing cycle** buttons **Monthly** / **Yearly**
   - **Final pricing** (users × per-user; can be edited)
6. **Interested modules** — tick services separately: **CRM**, **ATS**, **Employee Management**, **Payroll**. Each service the sales person selects is part of the deal (own commercial line / package).
7. Save. Reopen the company/client. Prices and selected services must still be there.
8. Also check left **Employers** → **Subscriptions** / **Ops** → **Billing** / AI plans if the build shows **per-feature coin prices** — each row should have its own price that sales/HQ can edit.

**Expected:** sales can enter price per user / final price and choose services; values persist. If every service does not have a **separate amount** field, note what exists (package vs per-service).

**Screenshot:** Create company commercial fields + selected modules.

---

## CRM-9. AI assistant — summarize data without API key (+ trainings)

| Field | Value |
| --- | --- |
| Category | Phase 2 (all pages) |
| Tracker status | Deployed — add trainings |
| Who | Employer |

**Click path**

1. **Employer login** → **CRM** → **Dashboard** (or **Leads**).
2. **Bottom-right** of the screen: two floating bots. The **HRYantra AI** button sits **above** the ARIA orb.
3. Click **HRYantra AI** (sparkles / brand icon). A chat drawer opens. **Do not paste an OpenAI key** — it must answer anyway (local/brain fallback).
4. Type: `Summarize business performance` → send (arrow at the **bottom of the chat**).
5. It must reply with a summary of live CRM data (leads/jobs/candidates), not “missing API key”.
6. **Training chips** under the welcome (or above the input): **Performance**, **Do next**, **Open jobs**, **Candidates**, **Follow-ups**, **Leads report**, **Interviews**, **Risks**, **Help**. Click each once. Answers must make sense.
7. Optional: also click **ARIA** (lower orb) and ask to summarize KPIs.

**Expected:** works **without** an API key in the tester’s browser. Training/suggestion chips are visible and usable.

**Screenshot:** HRYantra AI chat with a summary reply + the training chips.

---

## CRM-10. All pages — unsaved drawer data must alert (do not lose data)

| Field | Value |
| --- | --- |
| Category | Phase 2 drawers |
| Tracker status | Deployed |
| Who | Employer |

**Click path** (repeat the same idea on each module)

1. **CRM** → **Leads** → **Create Manually**. Type a **Company name**. **Do not save**.
2. Click the **X** at the **top-right of the drawer** (or click the dark overlay behind the drawer).
3. An alert must appear: **You have unsaved changes in this drawer. Do you want to discard them and close?** Buttons **Yes** / **No**.
4. Click **No** — drawer stays; the company name is still there.
5. Click **X** again → **Yes** — drawer closes (data discarded).
6. Repeat on:
   - **CRM** → **Clients** (add/edit drawer)
   - **Recruitment** → **Jobs** (Create Manually / job drawer)
   - **Recruitment** → **Candidates** (add/edit)
   - **Tasks & Activities** (task drawer)
7. Optional: start typing in a drawer, then click another **sidebar** item — same alert should appear.

**Expected:** typed data is not silently lost. Alert on close. **No** keeps the form.

**Screenshot:** the unsaved-changes dialog on a lead drawer.

---

# Sheet 3 — CRM / Jobs / HQ dashboards (tracker 1–27)

These 27 rows are a **third tracker**. Number them **P2-1** to **P2-27** in notes so they do not clash with sheet 1 or CRM-1…CRM-10.

Sheet 3 serial **28** is blank. Skip it.

Employer tests start with **Employer login** unless the row says HQ or Phase 1 guest.

---

## P2-1. Lead activity drawer (Call / WhatsApp / Meeting)

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads**. Click a lead row. Drawer opens from the **right**.
2. Scroll to **Quick Actions** (indigo card).
3. Click **Log Call**. Form title **Log Call**. Fill **Call Type**, duration, **Call Outcome**, **Notes**. Bottom-right **Save Call Log**.
4. Open the same lead again. **Quick Actions** → **Send WhatsApp**. Form title **Send WhatsApp Message**. Fill notes / message. Save.
5. **Quick Actions** → **Schedule Follow-up** (or drawer tab **Follow-up**). Use the type pills **Call** / **WhatsApp** / **Email** / **Meet**.
6. For a meeting: set date/time. Under **Postpone follow-up** click **Mark postponed**. Pick a delay pill, fill postpone reason, save. Date label becomes **Postponed date & time**.
7. After the meeting time: on **Follow-up**, complete the meet. Popup title **Complete a meet**. **Remark** has a red `*`. Leave it empty → **Mark done** must fail. Fill remark → **Mark done**.

**Expected:** Call and WhatsApp open note popups. Completing a meet requires a remark. Meetings can be postponed / rescheduled.

**Screenshot:** Quick Actions, Log Call, Complete a meet with Remark *, postpone controls.

---

## P2-2. Contact validation (company + director + email or phone)

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Leads** → top-right **Create Manually**.
2. Wizard steps at the **top of the drawer:** **Company** → **Location** → **Contacts** → …
3. On **Company**, leave **Company name** empty → **Next**. Red error **Company is required**.
4. Fill company. On **Contacts**, leave **Director name** empty → **Next**. Error **Director name is required**.
5. Fill director. Leave **both** email and phone empty (do not tick not-available on both) → **Next**. Error **Provide email or mobile number (at least one)**.
6. Fill **either** email **or** phone. Save must work.

**Expected:** company and director are mandatory. At least one of email or phone is required.

**Screenshot:** red errors on Company and Contacts.

---

## P2-3. Lead address sequence (Country → State → City → map)

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **Create Manually** (or edit a lead). Wizard step **Location**.
2. Two tabs under location: **Search address** | **Country / State / City**.
3. **Search address:** type in **Search location**. Pick a Google-style suggestion. Read-only tiles below must fill **Country**, then **State**, then **City**. Helper text: *same order as Google Maps*.
4. Switch to **Country / State / City**. Choose **Country**, then **State**, then **City** (state list depends on country; city depends on state).
5. Below the fields: map picker. Click the map (or use current-location if shown). Country / state / city should update.

**Expected:** order is Country → State → City, then map. Search autofill matches that order.

**Screenshot:** Location step with both tabs and the map.

---

## P2-4. Additional lead fields (events / reminders)

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **Create Manually**. Go to the **Other** step (or edit lead → Events card).
2. Section **Events**. Top-right of that row: **+** (tooltip **Add event**).
3. Columns: **Name of the event**, **Date**, **Reminder**, **Name of the person**, **Email**.
4. Add rows such as Birthday, Anniversary, or a special occasion name. Set **Date**, **Reminder**, person, email.
5. Save. Re-open the lead and confirm the event row is still there.

**Expected:** birthdate / anniversary / special occasion are stored as event rows with reminder date and email.

**Screenshot:** Events table with + and a filled row.

---

## P2-5. Missing data alerts

| Field | Value |
| --- | --- |
| Category | Phase 2 Leads / Clients |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. Open a lead that is missing a mandatory field (empty company or director). Drawer from the **right**.
2. A **corner popup** (bottom/side of the screen) appears: title like **Missing · Company** and message **Company name is required**. Click **OK**.
3. If several fields are missing, popups come **one after another**.
4. A last prompt asks **Fill missing mandatory fields … now?**
5. Repeat on a client drawer with missing **Company**.

**Expected:** missing mandatory fields alert in the corner; you can fill now or later.

**Screenshot:** corner alert **Missing · …**.

---

## P2-6. Inactive lead alerts

| Field | Value |
| --- | --- |
| Category | Phase 2 CRM Dashboard |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. Left sidebar → hover **CRM** → **Dashboard**.
2. Top category tabs: **My work** | **Insights & actions** | **Pipeline & records** | **Team & outreach** | **Hours & scores**.
3. Open **Insights & actions**. Find card **Stale pipeline** (example value **idle 30d+**).
4. Also check **Insights & follow-ups** / alerts for leads with no calls or meetings (**noTouch** style copy: leads with no calls or meetings yet).
5. Open a lead that has had no activity for a long time. Corner alerts may also show overdue follow-up.

**Expected:** idle / no-activity leads are surfaced on the dashboard (and optionally in the lead drawer).

**Screenshot:** **Stale pipeline** card and/or overdue follow-up alert.

---

## P2-7. Client meeting reminders (email / WhatsApp)

| Field | Value |
| --- | --- |
| Category | Phase 2 Clients |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Clients**. Open a client. Drawer from the **right**.
2. Go to the meetings / follow-up area. Click **Schedule Meeting / Follow-up**.
3. Set type **Meeting** (or Call / WhatsApp / Email). Set date/time and **Reminder** (not **No reminder**). Save.
4. On the meeting row, use the paper-plane icon (tooltip **Send reminder**).
5. Extra check — **Recruitment** → **Interviews** → schedule an interview. Toggles **Send Email Notification** and **Send WhatsApp Reminder** (on by default). Save and confirm the client/candidate is notified.

**Expected:** reminders can go out by email and/or WhatsApp. Screenshot the schedule form + reminder controls.

**Screenshot:** Schedule Meeting form, Reminder field, Send reminder icon, and/or interview reminder toggles.

---

## P2-8. HQ module / tab access

| Field | Value |
| --- | --- |
| Category | HQ Tenants |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ login**. Left sidebar **Employers** group → **Tenants** (`/hq?tab=tenants`).
2. Click a tenant row. Drawer from the **right**.
3. Drawer tabs: **Overview** | **Tabs** | others. Click **Tabs**.
4. Section **Sidenav tabs**. Each module is a toggle tile (on = blue). Turn one off (example **Leads** or **Jobs**).
5. Bottom **Save tabs**. Must keep at least one tab (error: **Select at least one tab to keep enabled.**).
6. Log in as that tenant. The disabled item must be gone from the **left sidebar**.

**Expected:** HQ can enable/disable tenant modules and tabs.

**Screenshot:** Tabs grid + Save tabs; tenant sidebar after change.

---

## P2-9. Dashboard views + Today / Week / Month

| Field | Value |
| --- | --- |
| Category | Phase 2 CRM Dashboard |
| Tracker status | Deployed |
| Who | Employer |
| Notes | Shortlist / filter on these views and date pills |

**Click path**

1. **CRM** → **Dashboard**.
2. Category tabs (under the page header): **My work** (general / assigned work), **Pipeline & records** (lead-wise / client-wise — search a record), **Team & outreach** (team-wise).
3. Top timeline pills (rounded bar): **Today** | **Yesterday** | **Week** | **30 days** | **Month** | **Quarter** | **Year** | **All**.
4. Click **Today**, then **Week**, then **Month**. KPIs and charts must change (or show empty for that window).
5. Optional: **Recruitment** → **Dashboard** has the same date pills.

**Expected:** General / client / lead / team style views exist. Date filters include Today, Week, Month.

**Screenshot:** category tabs + date pills with **Today** / **Week** / **Month**.

---

## P2-10. Chart drill-down popup

| Field | Value |
| --- | --- |
| Category | Phase 2 Dashboards |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Dashboard** → **Insights & actions** or **Team & outreach**.
2. Click a chart, KPI tile, or ranked row (cursor becomes pointer).
3. A **popup / modal** lists the detailed records (table of rows). Close with the X.
4. Repeat on **Recruitment** → **Dashboard** (KPI tiles and insight cards).

**Expected:** clicking a chart/KPI opens a detailed records popup, not a dead click.

**Screenshot:** chart + drill-down modal with rows.

---

## P2-11. Dashboard line graphs

| Field | Value |
| --- | --- |
| Category | Phase 2 Dashboards |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Dashboard** → **Insights & actions**. Look for area/line trend charts (not only pie/bar).
2. **Recruitment** → **Dashboard**. Same: line or area charts over time.
3. Optional HQ: **Employees** → **Dashboard** also has trend lines.

**Expected:** line (or area-line) graphs exist along with other chart types.

**Screenshot:** at least one line/area trend chart.

---

## P2-12. Dashboard KPIs (emails, WhatsApp, meetings, last activity, follow-ups)

| Field | Value |
| --- | --- |
| Category | Phase 2 CRM Dashboard |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **CRM** → **Dashboard** → **Team & outreach** (and **Insights & actions**).
2. Find KPI / communication cards labeled **Meetings**, **Emails**, **WhatsApp** (subtitle like **Calls, meetings, email & WhatsApp**).
3. Open **Follow-up dashboard** if shown.
4. Tables should include columns **Meetings**, **Follow-ups**, **Last activity**.

**Expected:** those KPIs are visible on the CRM dashboard.

**Screenshot:** Meetings / Emails / WhatsApp tiles + last activity column.

---

## P2-13. Hierarchy reports

| Field | Value |
| --- | --- |
| Category | Phase 2 CRM Dashboard |
| Tracker status | Deployed |
| Who | Employer (manager / admin) |

**Click path**

1. **CRM** → **Dashboard** → **Team & outreach**. Team stats / recruiter leaderboard.
2. Click **Hours & scores**. Per-person hours, utilization, scores vs standard week (may need AI coins to unlock).
3. Confirm a team lead sees their team, not only their own rows.

**Expected:** dashboards/reports follow user hierarchy (team vs self).

**Screenshot:** Team & outreach + Hours & scores.

---

## P2-14. AI coin deduction

| Field | Value |
| --- | --- |
| Category | Phase 2 AI |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. After login, **top bar, right:** coin balance (tooltip **N AI coins — click to buy more**). Note the number.
2. Run one AI action (examples): **Leads** → **Create with AI**, or floating **HRYantra AI** (bottom-right, above ARIA) → send a message, or **Jobs** → **Create with AI**.
3. Confirm cost badge if shown. After the action finishes, coin count must drop.
4. If balance is 0, the action is locked and the buy-coins modal may open.

**Expected:** every AI action deducts coins. Balance updates in the top bar.

**Screenshot:** coin badge before and after one AI action.

---

## P2-15. HQ token / AI coin management

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ** → **Employers** → **Tenants**. Open a tenant. **Overview** shows **AI coins**. Scroll to **AI coins** → **Coin balance** number field → save.
2. **Employers** → **Subscriptions** (`/hq?tab=plans`). Top pills: **Subscription plans** | **AI Plans** | **Coin packs**. Open **Coin packs** (page title **AI coin packs**). Create/edit a pack (name, coins, price).
3. Back in Phase 2 as the tenant: click the coin badge → purchase modal must list HQ packs.

**Expected:** HQ assigns tenant coin balance and manages packs.

**Screenshot:** tenant AI coins field + Coin packs tab.

---

## P2-16. Create client from Add Job

| Field | Value |
| --- | --- |
| Category | Phase 2 Jobs |
| Tracker status | Deployed |
| Who | Employer |
| Notes | Button lives on the **first wizard step**, not a separate “create job” page |

**Click path**

1. Left sidebar → hover **Recruitment** → **Jobs**.
2. Top-right of the jobs header: **Create with AI** or **Create Manually**. Wizard opens from the **right**.
3. First step heading **Select your client**. Search box **Search clients…**.
4. To the **right of the search box:** button **Create client** (plus icon).
5. If the list is empty, also **Create a new client** in the empty state.
6. Fill the client form, save. The new client is selected. Continue the job wizard.

**Expected:** you can create a client without leaving Add Job.

**Screenshot:** Select your client step with **Create client**.

---

## P2-17. Hide job from public portal

| Field | Value |
| --- | --- |
| Category | Phase 2 Jobs |
| Tracker status | Deployed |
| Who | Employer + Phase 1 guest |
| Notes | Tester should also verify on the public portal |

**Click path**

1. **Jobs** → **Create Manually** (or edit a job). Go through to **review / job details**.
2. Next to fields such as **Job Description**: pill **Visible to public** (eye). Click it → label becomes **Hidden from public** (eye-off). Tooltip: hidden from public job view, Phase 1 portal, and social posts.
3. Repeat on other field pills you want hidden (title, location, client name, etc.). Save / publish.
4. Open Phase 1 jobs (http://localhost:3000/en explore jobs, or the public job URL). Hidden fields / the job must not show as listed.

**Expected:** hidden fields (or the listing) do not appear on the public portal.

**Screenshot:** **Hidden from public** pill + public job page without that content.

---

## P2-18. LinkedIn job image

| Field | Value |
| --- | --- |
| Category | Phase 2 Jobs |
| Tracker status | Deployed |
| Who | Employer |

**Click path**

1. **Jobs** → create or edit a job. Reach the **LinkedIn** preview block (during publish / distribution).
2. Label **Post image (optional)**. Helper: JPG, PNG, or GIF published with the LinkedIn post when you save.
3. Click **Upload image**. Preview must show the image on the LinkedIn card.
4. Save / publish.

**Expected:** LinkedIn post includes the uploaded image.

**Screenshot:** LinkedIn preview with image + **Upload image**.

---

## P2-19. Recruiter profile on job page

| Field | Value |
| --- | --- |
| Category | Jobs (public + tenant) |
| Tracker status | **In Progress** |
| Who | Employer + Phase 1 guest |

**Click path**

1. **Recruitment** → **Jobs**. Open a job. Drawer tab **Assignment** (or similar). Confirm **Lead team member** / recruiter name is set.
2. Open the **public job page** (Phase 1 job details / apply page). Look for a **recruiter profile** card (photo, name, role) — not only **Contact person**.
3. If the public page has no recruiter profile, mark **Fail / In Progress**. Do not invent a block.

**Expected today:** In Progress. Screenshot Assignment tab + public job page as it actually looks.

**Screenshot:** job Assignment + public job page (presence or absence of recruiter profile).

---

## P2-20. About Company in job drawer

| Field | Value |
| --- | --- |
| Category | Phase 2 Jobs |
| Tracker status | **Not Started** |
| Who | Employer |

**Click path**

1. **Jobs** → **Create Manually** or open an existing job drawer.
2. Scroll every wizard step and every drawer tab. Look for **About Company** / **About the company**.
3. Record **Fail / Not Started** if the section is missing. Do not invent copy.

**Expected today:** Not Started. Screenshot the job drawer sections that exist.

**Screenshot:** job wizard/drawer with no About Company section.

---

## P2-21. Navbar: Employer → Entrepreneur

| Field | Value |
| --- | --- |
| Category | Phase 1 marketing |
| Tracker status | Deployed |
| Who | Guest (no login) |

**Click path**

1. Open http://localhost:3000/en
2. **Top bar, center:** links **Employee** | **Courses** | **Businesses** | **Entrepreneurs**.
3. There must be **no** nav label **Employer** / **Employers**. Click **Entrepreneurs**.

**Expected:** navbar says **Entrepreneurs**, not Employer.

**Screenshot:** top nav with **Entrepreneurs**.

---

## P2-22. Business Type (was Service Type)

| Field | Value |
| --- | --- |
| Category | Phase 1 / Phase 2 forms |
| Tracker status | Deployed |
| Who | Guest + Employer |

**Click path**

1. http://localhost:3000/en/services (or **Services** from marketing). Confirm labels talk about **business** / entrepreneurs, not **Service Type**.
2. **CRM** → **Leads** → **Create Manually** → **Business** step. Field **Services Needed** (and industry). Confirm there is no leftover **Service Type** label that should now read **Business Type**.
3. If you still see **Service Type** where the tracker asked for **Business Type**, mark **Fail** and screenshot it.

**Expected:** Service Type has been renamed to Business Type (or equivalent business wording). Screenshot the actual label.

**Screenshot:** the field/page that replaced Service Type.

---

## P2-23. Service page badge, title, description

| Field | Value |
| --- | --- |
| Category | Phase 1 Services |
| Tracker status | Deployed |
| Who | Guest |

**Click path**

1. Open http://localhost:3000/en/services
2. Hero **badge** (pill): **HR Yantra: Connect. Value. Grow.**
3. **Title:** **Transforming HR into Value for** / **Talent and Enterprise.**
4. **Description:** **Where Visionary Entrepreneurs and Top Talent Connect, Grow, and Scale.**
5. Lower **Entrepreneurs** section: badge **Entrepreneurs**, title **Run hiring end-to-end in one workspace**, description about leads, jobs, AI matching.

**Expected:** badge, title, and description match the updated copy (not old SAASA / Employer-only wording).

**Screenshot:** services hero + Entrepreneurs section.

---

## P2-24. HQ Employee vs Employer dashboards

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. **HQ login**. Left sidebar **Employees** → **Dashboard** (`/hq?view=employee`). Top view tabs: **Employee** | **Employer** | **Platform**.
2. **Employee** dashboard is Phase 1 job-seekers (candidates, applications, sessions).
3. Click **Employer** or sidebar **Employers** → **Dashboard** (`/hq?view=employer`). Phase 2 hiring orgs / tenants.
4. The two dashboards must not be the same page.

**Expected:** separate Employee and Employer HQ dashboards.

**Screenshot:** both views (Employee tab vs Employer tab).

---

## P2-25. Platform analytics

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. HQ top view tab **Platform** (`/hq?view=platform`) and/or **Employee** + **Employer** dashboards.
2. Confirm KPIs / charts covering **candidates**, **employers/tenants**, **CVs / applications**, **jobs**, **AI usage** (and related counts).
3. **Employees** → **Candidates**, **Portal jobs**; **Employers** → **Tenants**, **Companies** as supporting lists.

**Expected:** platform-level analytics for those entities exist.

**Screenshot:** Platform / Employee / Employer KPI strips.

---

## P2-26. Login analytics (time, session, device)

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. HQ **Employees** → **Dashboard** (`/hq?view=employee`).
2. Category tab **Engagement & sessions** (blurb: login sessions, duration, devices, and geo).
3. Find session list / charts: login time, logout or end time, **session duration**, **device**.
4. Check **Employer** dashboard for tenant login/session blocks if present.

**Expected:** login, logout/end, duration, and device are tracked and visible.

**Screenshot:** Engagement & sessions (duration + device).

---

## P2-27. Location analytics (country / state / city logins)

| Field | Value |
| --- | --- |
| Category | HQ |
| Tracker status | Deployed |
| Who | HQ |

**Click path**

1. Same HQ **Employee** dashboard → **Engagement & sessions**.
2. Charts / lists **logins by country**, **by city** (and state if shown).
3. Confirm a known test login from your city appears after you log in as a candidate (Phase 1) and refresh HQ.

**Expected:** country / state / city login breakdowns exist.

**Screenshot:** country and city login charts.

---

## Items not on the tracker

Sheet 1 serials **26** and **31** were missing. Sheet 3 serial **28** is blank. Do not invent tests for them.

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

**Suggested test order (sheet 1):** 20 → 41 → 1 → 36 → 37 → 7 → 4 → 2 → 5 → 6 → 8 → 9 → 17 → 23 → 27 → 11 → 15 → 16 → 12 → 13 → 22 → 28 → 29 → 34 → 3 → 18 → 10 → 30 → 33 → 40 → 14 → 25 → 32 → 39 → 19 → 21 → 35 → 38 → 24.

### Sheet 2 — CRM / Leads

| Sr | Task | Pass / Fail / Blocked | Notes | Screenshot file |
| --- | --- | --- | --- | --- |
| CRM-1 | Shareable lead form link | | | |
| CRM-2 | Lead phone validation | | | |
| CRM-3 | Company name + company email (On Hold) | | | |
| CRM-4 | Multi-select industry | | | |
| CRM-5 | Follow-up Call / WhatsApp / Meet / Email | | | |
| CRM-6 | Recent activity first | | | |
| CRM-7 | Job share WhatsApp + platforms | | | |
| CRM-8 | HQ service prices in CRM | | | |
| CRM-9 | AI assistant summarize (no API key) | | | |
| CRM-10 | Unsaved drawer alert | | | |

**Suggested test order (sheet 2):** CRM-1 → CRM-2 → CRM-4 → CRM-5 → CRM-6 → CRM-7 → CRM-10 → CRM-8 → CRM-9 → CRM-3.

