# Email OTP Setup Guide

## Overview

The system now sends OTP verification codes via email using Resend instead of (or in addition to) WhatsApp. The OTP is sent to **ghodehimanshu453@gmail.com** when a user enters their WhatsApp number.

## Setup Instructions

### 1. Install Resend Package

Navigate to the backend directory and install the Resend package:

```bash
cd backend
npm install
```

This will install the `resend` package (version 3.2.0) that was added to `package.json`.

### 2. Verify Environment Variables

Make sure your `.env` file has the following Resend configuration:

```env
RESEND_API_KEY=re_GejWT8xQ_9TT7Yko5BffUTuTcEeHxMJKw
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### 3. Email Recipient

The OTP is automatically sent to: **ghodehimanshu453@gmail.com**

This is hardcoded in `src/services/email.service.ts`. To change it, modify the `TO_EMAIL` constant.

## How It Works

### Flow

1. **User enters WhatsApp number** → Frontend calls `/api/auth/send-otp`
2. **Backend generates OTP** → Creates 6-digit code
3. **Backend saves OTP** → Stores in MongoDB with expiration (5 minutes)
4. **Backend sends email** → Sends OTP to ghodehimanshu453@gmail.com via Resend
5. **User receives email** → Checks email for OTP code
6. **User enters OTP** → Frontend calls `/api/auth/verify-otp`
7. **Backend verifies OTP** → Validates and marks candidate as verified

### Email Template

The email includes:
- Professional HTML design with SAASA B2E branding
- Large, easy-to-read OTP code
- WhatsApp number for reference
- Expiration time (5 minutes)
- Security notice

## API Response

### Send OTP Response

```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "data": {
    "candidateId": "...",
    "whatsappNumber": "+911234567890",
    "emailSent": true,
    "emailMessageId": "abc123...",
    "otp": "123456",  // Only in development mode
    "expiresAt": "2024-01-01T12:05:00.000Z"
  }
}
```

### Verify OTP Response

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "candidateId": "...",
    "isVerified": true
  }
}
```

## Frontend Updates

The frontend has been updated to reflect email verification:

1. **WhatsApp Page** (`/whatsapp`):
   - Button text changed to "Send OTP via Email"
   - Message updated to mention email instead of WhatsApp

2. **Verify Page** (`/whatsapp/verify`):
   - Shows email address: ghodehimanshu453@gmail.com
   - Message updated to check email for code
   - Development mode still shows OTP on screen

## Testing

### 1. Test Email Sending

```bash
# Start backend server
cd backend
npm run dev

# Test from frontend or use curl:
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"1234567890","countryCode":"+91"}'
```

### 2. Check Email

- Check inbox of **ghodehimanshu453@gmail.com**
- Look for email from **onboarding@resend.dev**
- Subject: "Your SAASA B2E Verification Code"
- OTP code should be prominently displayed

### 3. Verify OTP

Enter the 6-digit code from the email on the verify page.

## Troubleshooting

### Email Not Received

1. **Check Resend API Key**:
   - Verify `RESEND_API_KEY` in `.env` is correct
   - Check Resend dashboard for API key status

2. **Check Email Service Logs**:
   - Backend console will show email send status
   - Look for "OTP email sent successfully" or error messages

3. **Check Spam Folder**:
   - Email might be in spam/junk folder
   - Check all email folders

4. **Resend Limits**:
   - Free tier has sending limits
   - Check Resend dashboard for quota

### Email Service Errors

If email sending fails:
- OTP is still saved in database
- User can still verify using the OTP
- Check backend logs for specific error
- Verify Resend API key is valid

### Development Mode

In development mode (`NODE_ENV=development`):
- OTP is shown in API response
- OTP is displayed on frontend screen
- Email is still sent (for testing)

## Customization

### Change Email Recipient

Edit `src/services/email.service.ts`:

```typescript
const TO_EMAIL = 'your-email@example.com'; // Change this
```

### Customize Email Template

Edit the HTML template in `src/services/email.service.ts` in the `sendOTPEmail` function.

### Add Multiple Recipients

Modify the email service to accept recipient as parameter:

```typescript
export async function sendOTPEmail(
  otp: string, 
  whatsappNumber: string,
  recipientEmail?: string
): Promise<...> {
  const toEmail = recipientEmail || TO_EMAIL;
  // ... rest of code
}
```

## Production Considerations

1. **Remove OTP from API Response**: In production, don't return OTP in response
2. **Email Rate Limiting**: Implement rate limiting for OTP requests
3. **Email Templates**: Use Resend's template system for better management
4. **Error Handling**: Add retry logic for failed email sends
5. **Monitoring**: Set up email delivery monitoring

## Next Steps

1. Test the complete flow end-to-end
2. Verify emails are being received
3. Test OTP verification
4. Monitor email delivery rates
5. Consider adding email verification status tracking
