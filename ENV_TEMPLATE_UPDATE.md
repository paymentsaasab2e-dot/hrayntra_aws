# Environment Variables Update

## Add Template ID to .env

After creating the template in Resend dashboard, add the template ID to your `.env` file:

```env
# Resend Email
RESEND_API_KEY=re_GejWT8xQ_9TT7Yko5BffUTuTcEeHxMJKw
RESEND_FROM_EMAIL=onboarding@resend.dev

# Resend Template IDs
# Add your template ID here after creating it in Resend dashboard
RESEND_TEMPLATE_AUTH_OTP=re_xxxxxxxxxxxxx
```

## How to Get Template ID

1. Go to Resend Dashboard → Templates
2. Click on your `auth-otp` template
3. Copy the Template ID (starts with `re_`)
4. Paste it in `.env` file as `RESEND_TEMPLATE_AUTH_OTP`

## Template Not Configured?

If `RESEND_TEMPLATE_AUTH_OTP` is not set or doesn't start with `re_`:
- System will automatically use inline HTML email (fallback)
- OTP will still be sent successfully
- Check backend logs for "using inline HTML email" message

## Testing

After adding the template ID:
1. Restart backend server
2. Send OTP via API
3. Check backend logs for "via Resend template" message
4. Verify email uses template design
