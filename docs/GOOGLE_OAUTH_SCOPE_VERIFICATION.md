# Google OAuth — fix “Request minimum scopes” rejection

## Why Google rejected you

1. **Full Calendar scope** (`…/auth/calendar`) was requested. That allows sharing and **permanently deleting entire calendars**. Hryantra only creates/updates **events** (interviews / Meet). Use **`…/auth/calendar.events`** only.
2. Justifications were too vague and did not map **each scope → exact product feature**.
3. For `gmail.readonly`, selecting **Email backup/takeout** (and similar) conflicts with Google’s Limited Use rules. Select **Email client** (and optionally Email productivity) only.

Code has been updated to stop requesting full `calendar` and to keep Gmail / Calendar scopes separated.

---

## What to change in Google Cloud Console

1. Open **APIs & Services → OAuth consent screen → Edit app → Scopes**.
2. **Remove** (if present):
   - `https://www.googleapis.com/auth/calendar`
3. **Keep only** these sensitive / restricted scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
4. Also keep non-sensitive: `openid`, `…/auth/userinfo.email`, `…/auth/userinfo.profile`.
5. Click **Update** on the failed “Request minimum scopes” item and paste the texts below.
6. Re-submit verification. Users who connected earlier must **Disconnect → Connect** Gmail / Calendar so tokens pick up the new scopes.

---

## Features dropdown (`gmail.readonly`)

Select **only**:

- Email client  
- Email productivity  

**Do not select:** Email backup/takeout, Email reporting and monitoring (unless you truly ship those products).

---

## Paste: Sensitive scopes — “How will the scopes be used?”  
(`gmail.send` + `calendar.events`) — keep under 1000 chars

```
Hryantra is a B2B recruiting CRM (hryantra.com). Recruiters connect their own Google account in Settings → Communication.

1) gmail.send — Used only when the recruiter clicks Send in Hryantra Inbox / candidate messaging to deliver emails they compose (interview invites, follow-ups, offer notes) through their Gmail. We never send without an explicit user action. We do not use gmail.compose or full mail access for sending; gmail.send is the minimum send scope.

2) calendar.events — Used only to create and update interview/meeting events on the recruiter’s Google Calendar (and Google Meet links) from Hryantra Calendar / interview booking. We do not list, share, or delete calendars; therefore the broader auth/calendar scope is not requested. calendar.readonly cannot create events, so calendar.events is the minimum write scope.

Data stays in the recruiter’s Google account and our tenant workspace for that user. We do not sell or transfer Google user data to third parties for ads. More limited scopes cannot power in-app send + event create.
```

---

## Paste: Restricted scope — `gmail.readonly` — “How will the scopes be used?”

```
Hryantra Inbox is an in-app email client for recruiters. After the user connects Gmail, we call Gmail API users.messages.list and users.messages.get to show subject, sender, snippet, and body so they can read candidate replies next to the CRM record and reply without leaving Hryantra.

gmail.send alone cannot read inbox messages. gmail.metadata does not return message bodies, so it cannot power the Inbox UI. We therefore need gmail.readonly as the minimum read scope.

We do not use this scope for email backup/takeout, bulk export, spam filtering as a service, or monitoring other users’ mailboxes. Access is only for the signed-in recruiter’s own mailbox, only after OAuth consent, and only for displaying threads and composing replies inside Hryantra. Data is not sold or used for advertising.
```

---

## Demo video tip (App functionality step)

Record ~2–3 minutes showing:

1. Login → Settings → Connect Gmail / Google Calendar (consent screen showing **only** the scopes above).  
2. Inbox: open a thread (readonly) → Send a reply (`gmail.send`).  
3. Book an interview → event appears on Google Calendar (`calendar.events`).  
4. Say on camera: “We do not request full calendar delete/share; only calendar.events.”
