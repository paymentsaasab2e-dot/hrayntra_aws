# Resend Template Setup Guide

## Overview

This guide explains how to set up Resend email templates for the authentication system. The backend is configured to use Resend templates with a fallback to inline HTML.

## Step 1: Create Template in Resend Dashboard

### 1.1 Access Resend Dashboard
1. Go to [https://resend.com/dashboard](https://resend.com/dashboard)
2. Log in with your Resend account
3. Navigate to **Templates** section

### 1.2 Create Auth Category (Optional but Recommended)
1. Click **Categories** or **New Category**
2. Create a category named: `Auth`
3. This helps organize authentication-related templates

### 1.3 Create OTP Template

1. Click **Create Template** or **New Template**
2. Fill in the template details:
   - **Name**: `auth-otp`
   - **Category**: `Auth` (select the category you created)
   - **Subject**: `Your SAASA B2E Verification Code`

3. **Template Type**: Choose one of the following:

   **Option A: React Email Template (Recommended)**
   - Select "React Email" as template type
   - Use the React Email component structure
   - Variables are passed as props

   **Option B: HTML Template with Handlebars**
   - Select "HTML" as template type
   - Use Handlebars syntax: `{{variableName}}`
   - Copy HTML from `resend-templates/auth-otp.html`

4. **Template Content**: 
   - Copy the HTML from `backend/resend-templates/auth-otp.html`
   - Replace variables with Handlebars syntax:
     - `{{otp}}` - OTP code
     - `{{whatsappNumber}}` - WhatsApp number
     - `{{expiresInMinutes}}` - Expiration time
     - `{{supportEmail}}` - Support email
     - `{{year}}` - Current year

5. **Save Template**

### 1.4 Get Template ID

After creating the template:
1. Click on the template to view details
2. Copy the **Template ID** (format: `re_xxxxxxxxxxxxx`)
3. This ID will be used in your `.env` file

## Step 2: Configure Environment Variables

Add the template ID to your `.env` file:

```env
# Resend Email
RESEND_API_KEY=re_GejWT8xQ_9TT7Yko5BffUTuTcEeHxMJKw
RESEND_FROM_EMAIL=onboarding@resend.dev

# Resend Template IDs
RESEND_TEMPLATE_AUTH_OTP=re_xxxxxxxxxxxxx
```

Replace `re_xxxxxxxxxxxxx` with your actual template ID from Resend dashboard.

## Step 3: Template Variables

The backend automatically passes these variables to the template:

```typescript
{
  otp: "123456",                    // 6-digit OTP code
  whatsappNumber: "+911234567890",  // User's WhatsApp number
  expiresInMinutes: 5,              // OTP expiration time
  supportEmail: "support@saasab2e.com", // Support email
  year: 2025,                       // Current year
  companyName: "SAASA B2E"         // Company name
}
```

## Step 4: Test the Template

### 4.1 Test in Resend Dashboard
1. Go to your template in Resend dashboard
2. Click **Preview** or **Test**
3. Enter test values for variables
4. Send a test email to verify formatting

### 4.2 Test via Backend API

```bash
# Start backend server
cd backend
npm run dev

# Send OTP (will use template)
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"1234567890","countryCode":"+91"}'
```

Check the email inbox at `ghodehimanshu453@gmail.com` for the OTP email.

## Step 5: Verify Template is Working

1. **Check Backend Logs**:
   - Look for: `OTP email sent successfully via template: re_xxxxx`
   - If you see: `Template send failed, using fallback` - template is not configured correctly

2. **Check Email**:
   - Email should use the template design
   - Variables should be replaced with actual values
   - OTP should be prominently displayed

## Template Types in Resend

### React Email Templates
- Use React components
- Variables passed as props
- Better for complex templates
- Requires React Email setup

### HTML Templates (Handlebars)
- Use HTML with Handlebars syntax
- Variables: `{{variableName}}`
- Simpler setup
- Good for basic templates

## Fallback Behavior

If the template is not configured or fails:
- System automatically falls back to inline HTML email
- OTP is still sent successfully
- Check backend logs for fallback messages

## Adding More Templates

### Template Structure

1. **Create HTML file** in `resend-templates/` directory
2. **Add template type** to `EmailTemplateType` enum in `src/templates/email.templates.ts`
3. **Add template ID** to `.env` file
4. **Add variable mapping** in `getTemplateVariables()` function
5. **Create template** in Resend dashboard
6. **Update `.env`** with template ID

### Example: Welcome Email Template

1. Create `resend-templates/auth-welcome.html`
2. Add to enum:
   ```typescript
   AUTH_WELCOME = 'auth-welcome',
   ```
3. Add to `.env`:
   ```env
   RESEND_TEMPLATE_AUTH_WELCOME=re_xxxxxxxxxxxxx
   ```
4. Create template in Resend dashboard
5. Use in code:
   ```typescript
   await sendWelcomeEmail(userName, userEmail);
   ```

## Troubleshooting

### Template Not Working

1. **Check Template ID**:
   - Verify `RESEND_TEMPLATE_AUTH_OTP` in `.env` matches Resend dashboard
   - Template ID should start with `re_`

2. **Check Template Variables**:
   - Ensure variable names match between template and code
   - Check Resend documentation for variable syntax

3. **Check API Key**:
   - Verify `RESEND_API_KEY` is correct
   - Check API key permissions in Resend dashboard

4. **Check Logs**:
   - Backend console shows template send status
   - Look for error messages

### Fallback is Being Used

If you see "using fallback" in logs:
- Template ID might be incorrect
- Template might not exist in Resend
- API key might not have template access
- Check Resend dashboard for template status

## Best Practices

1. **Test Templates First**: Always test in Resend dashboard before using in production
2. **Version Control**: Keep HTML templates in version control
3. **Documentation**: Document all template variables
4. **Fallback**: Always have fallback HTML ready
5. **Monitoring**: Monitor email delivery rates
6. **Variables**: Use consistent variable naming

## Next Steps

1. ✅ Create template in Resend dashboard
2. ✅ Add template ID to `.env`
3. ✅ Test template with backend API
4. ✅ Verify email delivery
5. ✅ Monitor email performance
6. ✅ Add more templates as needed
