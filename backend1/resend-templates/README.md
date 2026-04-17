# Resend Email Templates

This directory contains HTML templates for Resend email service. These templates should be created in your Resend dashboard and referenced by their template IDs.

## Template Structure

### Auth Templates

#### 1. `auth-otp` - OTP Verification Email
- **Template ID**: `auth-otp` (or set via `RESEND_TEMPLATE_AUTH_OTP` env variable)
- **Purpose**: Send OTP verification codes to users
- **Variables**:
  - `{{otp}}` - 6-digit verification code
  - `{{whatsappNumber}}` - User's WhatsApp number
  - `{{expiresInMinutes}}` - OTP expiration time (default: 5)
  - `{{supportEmail}}` - Support email address
  - `{{year}}` - Current year

## How to Create Templates in Resend

### Step 1: Access Resend Dashboard
1. Go to [Resend Dashboard](https://resend.com/dashboard)
2. Navigate to **Templates** section
3. Click **Create Template**

### Step 2: Create Auth OTP Template

1. **Template Name**: `auth-otp`
2. **Category**: `Auth` (create this category if it doesn't exist)
3. **Subject**: `Your SAASA B2E Verification Code`
4. **HTML Content**: Copy the content from `auth-otp.html` in this directory
5. **Text Version**: (Optional) Plain text version for email clients that don't support HTML

### Step 3: Configure Template Variables

In Resend, you can use variables in the format `{{variableName}}`. The template supports:
- `{{otp}}` - Will be replaced with the actual OTP code
- `{{whatsappNumber}}` - Will be replaced with user's WhatsApp number
- `{{expiresInMinutes}}` - Will be replaced with expiration time
- `{{supportEmail}}` - Will be replaced with support email
- `{{year}}` - Will be replaced with current year

### Step 4: Get Template ID

After creating the template in Resend:
1. Copy the Template ID (usually looks like `re_xxxxxxxxxxxxx`)
2. Add it to your `.env` file:
   ```env
   RESEND_TEMPLATE_AUTH_OTP=re_xxxxxxxxxxxxx
   ```

## Environment Variables

Add these to your `.env` file:

```env
# Resend Email
RESEND_API_KEY=re_GejWT8xQ_9TT7Yko5BffUTuTcEeHxMJKw
RESEND_FROM_EMAIL=onboarding@resend.dev

# Resend Template IDs
RESEND_TEMPLATE_AUTH_OTP=re_xxxxxxxxxxxxx
RESEND_TEMPLATE_AUTH_WELCOME=re_xxxxxxxxxxxxx
RESEND_TEMPLATE_AUTH_RESET_PASSWORD=re_xxxxxxxxxxxxx
```

## Template Variables Mapping

The backend automatically maps data to template variables:

### Auth OTP Template
```typescript
{
  otp: "123456",
  whatsappNumber: "+911234567890",
  expiresInMinutes: 5,
  supportEmail: "support@saasab2e.com",
  year: 2025
}
```

## Testing Templates

### 1. Test in Resend Dashboard
- Use Resend's preview feature to test templates
- Send test emails to verify formatting

### 2. Test via Backend
```bash
# Start backend
npm run dev

# Send OTP (will use template if configured)
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"1234567890","countryCode":"+91"}'
```

## Fallback Behavior

If template sending fails, the system automatically falls back to inline HTML email. This ensures emails are always sent even if templates aren't configured.

## Adding New Templates

1. Create HTML file in `resend-templates/` directory
2. Add template type to `EmailTemplateType` enum in `src/templates/email.templates.ts`
3. Add template ID to environment variables
4. Add template variable mapping in `getTemplateVariables()` function
5. Create template in Resend dashboard
6. Update `.env` with template ID

## Template Best Practices

1. **Responsive Design**: Use table-based layouts for email compatibility
2. **Inline Styles**: Use inline CSS (email clients don't support external stylesheets)
3. **Fallback Colors**: Always specify background colors
4. **Alt Text**: Include alt text for images
5. **Plain Text Version**: Provide plain text fallback
6. **Testing**: Test in multiple email clients (Gmail, Outlook, Apple Mail)
