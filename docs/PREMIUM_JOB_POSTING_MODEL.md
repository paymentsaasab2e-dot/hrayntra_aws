# Software Requirements Specification (SRS)

**Product:** HRYantra free job posting + Premium plan  
**Version:** 1.1  
**Status:** Draft for review and edit  
**Business model:** Freemium — core hiring is free; extra job posts are paid

---

## 1. What we are building

HRYantra lets a company:

1. Sign up for free and fill company details.
2. Get an employer account and dashboard.
3. Post jobs (Free plan = **10 published jobs per calendar month**).
4. Show those jobs on HRYantra, and on social / external boards when connected.
5. Let candidates see the job and apply.
6. Let the company see every applicant on that job.
7. Buy **Premium** only if they need to post more than 10 jobs in that month.

No payment is needed to start. Premium is for **more job posts**, not for unlocking applications.

---

## 2. Simple end-to-end story

```
Company opens Login / Signup
        ↓
Fills company information (name, industry, location, etc.)
        ↓
Account created on Free plan (10 jobs / month)
        ↓
Creates a job and clicks Publish
        ↓
Job goes live on HRYantra + selected social / job boards
        ↓
Candidate finds the job and applies
        ↓
Company sees the applicant on that job
        ↓
If they already posted 10 jobs this month → Premium popup
        ↓
They pay → quota increases → they can publish more
```

---

## 3. Goals

- Free registration for companies and candidates.
- Company profile + job posting from day one.
- Monthly free job quota (default **10**).
- Premium upgrade when they need more posts.
- Jobs on our platform, and on supported social / external channels.
- Candidates can search, apply, and track status.
- Employers can manage applicants.
- HQ / admin can manage companies, jobs, plans, and payments.

---

## 4. Who uses it

| Role | Who | What they can do |
| --- | --- | --- |
| **Employer** | Company that signed up | Register, post jobs, buy Premium, review applicants |
| **Candidate** | Job seeker | Register, search jobs, apply, see application status |
| **Company team member** | Extra user in the same company | Help with jobs / applicants (later; optional in v1) |
| **HQ / Super Admin** | HRYantra team | Companies, jobs, plans, payments, reports, moderation |

---

## 5. Public pages

| Page | Purpose |
| --- | --- |
| Home | What HRYantra is, search, featured jobs, Sign up / Login |
| Browse jobs | Search and filter open jobs |
| Job details | Full JD + **Apply now** |
| Companies | Public company pages and their open jobs |
| Employer signup | Free company registration |
| Candidate signup | Job seeker registration |
| Login / Forgot password | Sign in and reset password |
| Pricing | Free vs Premium, quota, price, upgrade |
| About / Contact | Company info and support |
| Legal | Terms, privacy, posting rules |

Employer app after login: dashboard, jobs, create job, applicants, subscription.  
Candidate app after login: profile, resume, my applications.

---

## 6. Company signup (Free)

Signup is free. Collect account + company information before the workspace is created.

### Account fields

| Field | Required |
| --- | --- |
| Full name / contact person | Yes |
| Work email | Yes (verify) |
| Phone | Yes (OTP optional) |
| Password | Yes |
| Terms and privacy consent | Yes |

### Company fields

| Field | Required |
| --- | --- |
| Company name | Yes |
| Industry | Yes |
| Company size | Yes (range) |
| Company type | Optional (Pvt Ltd, LLP, Startup, etc.) |
| Country / state / city / address | Yes (city + country minimum) |
| Website | Optional |
| About the company | Optional at signup |
| Logo | Optional at signup |
| GST / business ID | Optional (can be required later by admin) |

### After submit

1. Validate fields and verify email.
2. Create the user + company workspace.
3. Attach the company profile.
4. Assign **Free plan: 10 jobs / calendar month**.
5. Open the employer dashboard.
6. They can complete profile and post jobs.

Admin may later require extra verification before a company can publish.

---

## 7. Plans

### Free (default)

- Price: **₹0**
- **10 published jobs per calendar month**
- Company profile and dashboard
- Create, draft, publish, edit, close jobs
- Jobs on HRYantra apply / job pages
- Social + external boards **for those 10 jobs**, when integrations are on
- See applicants, resumes, and change status
- No payment at signup

### Premium (paid upgrade)

- Price: **to be finalized** (monthly and optional yearly)
- **More posts** (example: 50 / month) **or unlimited**
- Everything in Free
- Usage + billing on Subscription page
- Invoices and payment history
- Extra benefits later (analytics, priority support) if we add them

**v1 rule:** Premium mainly sells **more job posts**. Applicant inbox stays free.

---

## 8. Job quota rules (important)

Count **successfully published jobs** in the **current calendar month**, per company.

| Action | Uses a slot? |
| --- | --- |
| Save as draft | No |
| First publish of a new job | **Yes** |
| Edit an already published job | No |
| Close / pause / unpublish | No (slot not refunded) |
| Publish the same job again in the same month | No |
| Publish a draft that was never live | **Yes** |
| Duplicate job then publish | **Yes** (it is a new job) |

- Quota resets on the **1st of each month**.
- Unused Free slots **do not** carry over.
- Backend must enforce this. UI alone is not enough.

**Example**

1. Company signs up → 10 left.
2. Publishes 1 job → 9 left.
3. Publishes 9 more → 0 left.
4. Tries to publish job 11 → **blocked**, Premium modal.
5. Buys Premium → new limit applied, can publish.
6. 1st of next month → Free users get 10 again.

---

## 9. When Free quota is finished

1. Do **not** publish the extra job.
2. Keep it as a **draft** if they already filled the form.
3. Show a Premium modal:
   - “You have used **10 of 10** free job posts this month.”
   - What Premium gives them.
   - **Upgrade to Premium** / **Maybe later**.
4. Same block if they click **Add job** on the Jobs list while quota is full.
5. After a successful payment, they can publish the draft immediately.
6. If they do not upgrade, the job stays unpublished.

Suggested UI line:

- `Job posts this month: 7 / 10`
- When full: `10 / 10 — Upgrade to post more`

---

## 10. Premium purchase

1. Employer clicks Upgrade (modal, sidenav, or Pricing / Subscription).
2. Chooses monthly or yearly.
3. Pays (Razorpay or current gateway).
4. Webhook confirms payment (no double activation).
5. Workspace becomes Premium; quota updates.
6. They can post again in the same session.

If payment fails → stay on Free, extra job not published.  
If Premium expires / cancelled → back to Free. **Jobs already live stay live.** New publishes limited to 10 / month again.

Also needed: invoices, payment history, reminders before expiry, failed-payment handling, admin coupons / manual grant with audit log.

---

## 11. Create and publish a job

Employer fills the job (title, location, salary, JD, openings, apply form, where to publish).

On **Publish** (if quota remains):

1. Save job as **Active** in the company workspace.
2. Put it on HRYantra (public job + apply page).
3. Post / share to connected social accounts (LinkedIn, etc.).
4. Send to selected external boards (Adzuna, Careerjet, and others we support).
5. Count **1** against this month’s quota.

### Job fields (v1)

| Field | Required |
| --- | --- |
| Job title | Yes |
| Company | Auto from account |
| Description / JD | Yes |
| Location (unless remote) | Yes |
| Employment type | Yes |
| Work mode (onsite / remote / hybrid) | Recommended |
| Experience | Recommended |
| Skills | Recommended |
| Responsibilities | Recommended |
| Salary | Optional |
| Openings | Optional |
| Education | Optional |
| Deadline | Optional |
| Screening questions / apply form | Optional |
| Distribution channels | Selected by employer |

Incomplete or blocked content must not go live.

Employer job actions: create, draft, preview, publish, edit, pause/close, duplicate, see applicants, see distribution status.

---

## 12. Where the job is shown

A published job should appear on **our platform first**. Other channels are extra and only if we really support them.

| Channel | What it does |
| --- | --- |
| HRYantra job board / apply page | Always, for a published job |
| LinkedIn | Post or share if the employer connected LinkedIn |
| Other social | Only approved, connected integrations |
| Adzuna / Careerjet / similar | Feed or API if the employer selected it |
| Google Jobs | Public job page with JobPosting structured data |

**Honest status:** we cannot claim “posted everywhere” unless the channel actually succeeded. Each provider has its own API, approval, and rules. Some channels are share-links only.

Statuses per channel: Pending, Processing, Published, Failed, Awaiting approval, Not supported, Removed / expired.

Failed sends are logged and retried only when safe. Do not duplicate. Store job id, external id, channel, status, last sync time.

Failed external publish **must not** unpublish the job on HRYantra.

---

## 13. Candidates

### Signup

Name, email (verify), phone (OTP optional), password, location, headline, experience, skills, education, resume, LinkedIn / portfolio (optional).

### Search

Title, skills, company, location, experience, salary, industry, employment type, remote/hybrid/onsite, date posted, category.

Result card: title, company, location, work mode, date, Apply.

### Apply

1. Open job → **Apply now**.
2. Login / register if needed.
3. Confirm profile + resume + form answers.
4. Block duplicate apply to the same job (unless we later allow re-apply).
5. Save application with an id.
6. Notify employer (in-app + email if on).
7. Candidate sees it under My applications.

---

## 14. Employer sees applicants

On the job (Candidates / Pipeline / Applications):

- Name, apply date, resume, experience, skills
- Contact (only if they are allowed to see it)
- Screening answers
- Status and notes
- Filter, search, export (where allowed)

**Statuses:** Applied, Under review, Shortlisted, Interview, Selected, Rejected, Withdrawn, Hired.

Candidates only see statuses we choose to show them.

Free and Premium both keep this inbox. Premium does **not** hide applications.

---

## 15. Employer dashboard

Show at a glance:

- Total / active / draft / closed jobs
- Total applications, new, shortlisted, rejected
- Job posts used this month (`7 / 10`)
- Current plan and renewal / expiry date
- Recent applications

---

## 16. HQ / Admin

- Search companies and candidates
- Verify, suspend, reactivate accounts
- View / moderate / take down jobs
- Categories, skills, industries
- Create Free and Premium plans, quotas, prices, duration
- Payments, coupons, failed charges, manual extensions (with audit)
- Reports: companies, candidates, jobs/month, applications, Free → Premium conversion, revenue, distribution success/fail

---

## 17. Notifications

| Event | Who |
| --- | --- |
| Signup / email verify | User |
| Job published | Employer |
| Job expiring soon | Employer |
| New application | Employer |
| Application submitted | Candidate |
| Application status change | Candidate (if we show that status) |
| Quota used up | Employer |
| Payment success / fail | Employer |
| Subscription near expiry / expired | Employer |
| External distribution failed | Employer and/or admin |

Keep volume reasonable. Let users change email prefs where we can.

---

## 18. Must-have vs later

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-001 | Employer signup + email verify | Must |
| FR-002 | Candidate signup + login | Must |
| FR-003 | Company profile | Must |
| FR-004 | Auto Free plan (10 jobs / month) | Must |
| FR-005 | Create / edit / publish job | Must |
| FR-006 | Monthly quota on the backend | Must |
| FR-007 | Premium modal at 11th job | Must |
| FR-008 | Premium pay + activate | Must |
| FR-009 | Public job search + details | Must |
| FR-010 | Candidate apply | Must |
| FR-011 | Employer applicant list | Must |
| FR-012 | Application statuses | Must |
| FR-013 | HQ admin | Must |
| FR-014 | Social / external publish | Only where we have access |
| FR-015 | Distribution status on the job | Must for each integration |
| FR-016 | Email + in-app notices | Must |
| FR-017 | Payment history | Must |
| FR-018 | Reports | Should |
| FR-019 | Extra company team members | Optional in v1 |
| FR-020 | AI resume parse / matching | Later |

**Not in v1 unless we agree separately:** native mobile apps, “post to every job board in the world”, paid third-party job-board APIs, full ATS/payroll/onboarding, heavy AI ranking, huge historical imports, SMS/ad spend.

---

## 19. Security and quality (short)

- Hash passwords. Check auth on the server.
- Company A cannot see Company B’s jobs or applicants.
- Do not store card numbers; the payment gateway does.
- Rate limit, validate input, log admin actions.
- Publish UI must stay fast; external posting runs in the background.
- Backups, monitoring, privacy consent, account deletion.

---

## 20. Build order

1. Free signup with company fields + Free plan of 10 jobs / month.
2. Publish job → HRYantra apply page + selected social / boards.
3. Candidate apply → employer sees them on the job.
4. Count published jobs this month.
5. Block at 11 with Premium modal.
6. Checkout upgrades the company and unblocks posting.
7. HQ plans, payments, and basic reports.

---

## 21. Done when

- New company signs up free and can post jobs.
- Jobs show on HRYantra and on channels they selected (when those channels work).
- Candidates apply; employer sees them.
- 11th job in a month is blocked until Premium.
- After payment they can post again the same day.
- On the 1st of next month, Free quota is 10 again.
- Duplicate payment webhooks do not grant Premium twice.
- One company cannot see another company’s applicants.

---

## 22. Choices to confirm (edit this list)

Current defaults — change them here if you want a different product:

1. **Free posts:** 10 per calendar month  
2. **Reset:** 1st of each month (not 30 days from signup)  
3. **Billing:** monthly + optional yearly  
4. **Distribution:** our job board first; social + external boards as modules  
5. **Job go-live:** publish immediately; HQ can take down later  
6. **Apply:** on our platform (optional external apply URL later)  
7. **Premium:** mainly more job posts; recruitment inbox stays free  

Edit this file, then we can start development from this version.
