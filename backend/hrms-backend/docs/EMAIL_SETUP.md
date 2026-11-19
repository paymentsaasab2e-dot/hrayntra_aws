# Resend email setup (new user welcome mail)

When a superadmin creates a user in **Users**, the backend sends a welcome email with login details (email, password, role, employee ID if linked).

## 1. Get a Resend API key

1. Sign up at [resend.com](https://resend.com)
2. Create an API key in the dashboard
3. For testing, use Resend’s sandbox sender: `onboarding@resend.dev` (only delivers to your verified account email until you add a domain)

## 2. Configure `hrms_backend/.env`

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=HRMS Yantra <otp@allorashopee.com>
RESEND_TEMPLATE_AUTH_OTP=your-template-id
HRMS_APP_URL=http://localhost:3000
```

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Required to send mail |
| `RESEND_FROM_EMAIL` | Verified sender in Resend (name + email) |
| `HRMS_APP_URL` | Login link in the email body |

## 3. Restart backend

```powershell
cd hrms_backend
npm run dev
```

## 4. Test

1. Log in as superadmin → **Users**
2. Create a user with a real inbox you can access
3. Check API response: `"email": { "sent": true }`
4. User receives **Your HRMS Yantra account details**

If `RESEND_API_KEY` is empty, the user is still created but email is skipped (no error).

## Production

- Add and verify your domain in Resend
- Set `RESEND_FROM_EMAIL` to e.g. `HRMS <noreply@yourdomain.com>`
- Set `HRMS_APP_URL` to your production HRMS URL
