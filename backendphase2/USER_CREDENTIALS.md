# Role seed reference (NO PASSWORDS)

**Do not store real passwords, Mongo URIs, API keys, or user ObjectIds in this file.**

Credentials must be created via:
- Team → Generate credentials (in-app), or
- A one-time secure channel (password manager / sealed ops handoff)

If you need a private local cheat-sheet, use `USER_CREDENTIALS.local.md` (gitignored).

---

## Seed roles (login IDs are examples — verify in DB)

| Role | Example email | Example login ID |
|------|---------------|------------------|
| Super Admin | superadmin@saasa.com | super.admin@saasa |
| Admin | admin@saasa.com | admin.user@saasa |
| Senior Recruiter | senior.recruiter@saasa.com | john.recruiter@saasa |
| Recruiter | recruiter@saasa.com | jane.smith@saasa |
| Account Manager | account.manager@saasa.com | mike.manager@saasa |
| Finance | finance@saasa.com | sarah.finance@saasa |
| Viewer | viewer@saasa.com | viewer.user@saasa |

**Passwords:** never paste here. After any leak, force password reset for all seeded users.

---

## Compromised-password response

1. Rotate passwords for every account that ever appeared in git history.
2. Revoke active sessions (logout-all / refresh revoke).
3. Confirm this file and `USER_CREDENTIALS.local.md` contain no secrets before pushing.
