# HQ Account Support — Incomplete CV / Shell Accounts

Simple guide: what goes wrong, why, and what to do.

---

## 1. What the problem looks like

In HQ / employer **Candidates** you may see rows like:

| What you see | Meaning |
|---|---|
| Candidate name = **—** | No name saved |
| Only email | Account was created |
| Source = `phase1_portal` | Came from job portal |
| Status = NEW | Never finished onboarding |
| Resume open crashes / empty | CV never finished parsing |
| User says “I can’t log in / profile empty” | Shell account |

Example: email exists (`user@gmail.com`) but name, title, location are all blank.

---

## 2. Root causes (edge cases)

These usually happen when **internet drops during CV upload / parse**:

1. **Signup OK → upload fails**  
   Account created, but CV file never reached the server.

2. **Upload starts → page redirects too early** *(fixed)*  
   Old bug: went to “analyzing” before upload finished → empty shell.

3. **File uploaded → AI parse dies mid-way**  
   File exists, but name / experience never saved (half-parsed).

4. **Wrong email typed in Account support**  
   Portal has `rushabhlamkhade…` but search used a typo → “Account does not exist”.

5. **Email-only shell synced into CRM**  
   Incomplete profile showed up in candidate lists for recruiters.

---

## 3. Stages (happy path)

```
1. Create account (email verified)
2. Upload CV  → must succeed (with retries)
3. Save file + queue parse
4. AI parse → fill name, work, skills
5. Sync to CRM (only when profile has real data)
```

If any stage fails → treat as **incomplete shell** and use HQ tools below.

---

## 4. What to do in HQ (simple steps)

### Step A — Search correctly

1. Open **HQ → Account support**
2. Paste the **exact** email the user shared (or candidate ID)
3. Click **Check status**

> Tip: copy email from the portal / ticket — don’t retype.

---

### Step B — Read the result

| Result | Meaning | Action |
|---|---|---|
| **Account does not exist** | No portal/CRM match for that email | Go to Step C |
| **Exists + incomplete / needs_cv / stuck parse** | Shell or half-parsed | Go to Step D |
| **Exists + looks complete** | Normal account | Password / login tools only |

Related **tickets** for that email still show even when account is “not found”.

---

### Step C — Not found

You get two buttons:

1. **Ask user: re-upload CV**  
   Opens upload page. Tell the user: sign in → upload CV again.

2. **Create / reuse portal ID**  
   - If an **incomplete** shell already has that email → **same ID**, incomplete data overridden  
   - If **nothing** exists → **new ID** + temp password emailed  
   - If **complete** account exists → returns that ID (no duplicate)

Then ask the user to **re-upload CV** to finish.

---

### Step D — Found but incomplete

Click **Repair incomplete profile**.

What it does:

- Fills a temporary name from email if name is blank  
- Re-queues CV parse if a file is already on the server  
- If no file → asks for **re-upload** and opens upload link  

---

### Step E — Direct login (hidden)

1. Double-click the search box  
2. Use **Login as candidate (job portal)** or **Login as entrepreneur (CRM)**  

Use only for support / debugging.

---

## 5. What to tell the user (copy/paste)

**Re-upload CV:**

> Please sign in to the job portal, open Upload CV, upload your resume, and keep the page open until processing is complete.

**Complete registration + sign in:**

> Please complete registration: verify the OTP sent to your email, set your password, upload your CV, and keep the page open until processing finishes. You may then sign in with your email and password.

---

## 6. Prevention (already in product)

| Fix | Why |
|---|---|
| Upload waits for success + retries (×3) | No redirect before file is saved |
| Extract timeout → back to upload (not dashboard) | Don’t leave empty profiles as “done” |
| Polling ignores short network blips | Don’t fail the whole flow on one bad request |
| CRM sync skips email-only shells | Don’t pollute candidate lists |
| Server recovers stuck parse jobs on restart | Half-parsed CVs can finish later |

---

## 7. Quick decision tree

```
Search email / candidate ID
        │
        ├─ Not found ──────────► Related tickets?
        │                         ├─ Ask re-upload CV
        │                         └─ Create / reuse portal ID
        │                              (overrides incomplete shell if any)
        │
        ├─ Incomplete shell ───► Repair incomplete profile
        │                         └─ then ask re-upload if needed
        │
        └─ Complete ───────────► Check password / login / tickets
```

---

## 9. Special case — “Account exists” on create, “No account” on sign-in

**Example:** Rajesh Pandey (`rajeshpandey4474@gmail.com`)

| What user sees | Why |
|---|---|
| Create account → “account already exists” | Email row exists in DB (shell) |
| Sign in → “No account found” / create account | Shell exists but **not verified** / no usable password login |
| Wrong text “this number” while using email | Old UI always said “number” *(fixed)* |

### What we do (support)

1. HQ → Account support → exact email → **Repair** or **Create / reuse portal ID**
2. Ask user to complete registration + **re-upload CV**

### What the user now sees (professional, action-only)

**Title:** Please complete your registration  

**Message:**  
To access your account, please continue registration: verify your email, set a password, then upload your CV and wait until processing finishes.

**Hint:**  
Keep the upload page open until your profile analysis is complete. If your profile still appears empty, upload your CV once more.

**Button:** Continue registration  

### Support reply you can send

> Dear Rajesh,  
>  
> Thank you for contacting HRYantra Support.  
>  
> Please complete the following steps to activate your account:  
>  
> 1. Open **Create account** and verify the OTP sent to your email.  
> 2. Set your password.  
> 3. Upload your CV and keep the page open until processing is complete.  
> 4. Sign in with your email and password.  
>  
> If your profile still appears empty after upload, please upload the CV once more.  
>  
> We remain available should you need further assistance.  
>  
> Kind regards,  
> HRYantra Support

---

## 10. Restart note

After deploying these changes, restart:

- Phase 1 API (`backend1`)
- Phase 2 API + frontend (`backendphase2` / `frontphase2`)
- Job portal frontend (`jobportal_himanshu`)

Then use **Account support** as above.

---

## 11. Test with ONE job-portal account (exact steps)

Use one new email only, for example `you+test1@gmail.com`. Restart job portal + Phase 1 API first.

### A — Account not found / registration not finished (Rajesh type)

1. Open job portal → **Create account**.
2. Enter the test email + mobile → send OTP.
3. **Do not enter the OTP.** Close the tab.
4. Open **Sign in** → same email → any password → **Sign in**.
5. **Pass:** blue panel **“Please complete your registration”** and button **Continue registration**.  
   It must not say “this number” when you used email.
6. Click **Continue registration** → finish OTP → set password → upload CV → wait until done.
7. Sign out, sign in again with email + password.
8. **Pass:** dashboard opens with profile data (name / experience from CV).

### B — Can sign in, but profile data is missing

Do this only after the account can sign in (password set, verified), but **no CV** was uploaded.

1. Sign in with that same email + password.
2. **Pass:** on **Dashboard** and on **Profile**, you see:
   - a white card: **“Upload your CV to complete your profile”**
   - a popup with **Upload CV** and **Not now**
3. Click **Upload CV** (card or popup).
4. **Pass:** you land on the Upload CV page (not a blank profile).
5. Upload a PDF/DOCX and wait until analysis finishes.
6. Open Dashboard and Profile again.
7. **Pass:** the card and popup are gone. Name and experience show.

**Not now** only hides the popup for this browser session. The card stays until a CV is saved.

### C — HQ (same email)

1. HQ → Account support → paste the same email → **Check status**.
2. Before CV: incomplete / needs upload → **Repair incomplete profile** or ask them to use **Upload CV** on the portal.
3. After CV: account exists, onboarding looks complete.
