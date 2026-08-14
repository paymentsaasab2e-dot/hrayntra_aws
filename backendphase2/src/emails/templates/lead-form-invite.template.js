function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function leadFormInviteTemplate({
  name,
  designation,
  email,
  password,
  formUrl,
  loginId,
}) {
  const safeName = escapeHtml(name || 'there');
  const safeDesignation = escapeHtml(designation || '');
  const safeEmail = escapeHtml(email || '');
  const safePassword = escapeHtml(password || '');
  const safeLoginId = escapeHtml(loginId || email || '');
  const safeUrl = escapeHtml(formUrl || '');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lead form invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 24px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">You have been invited to add a lead</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <p style="margin-top: 0;">Hello <strong>${safeName}</strong>,</p>
        <p>Use the login details below to open the lead form. Sign in with your Login ID (or Gmail) and this password, then fill in the lead details.</p>
        ${
          safeDesignation
            ? `<p><strong>Designation:</strong> ${safeDesignation}</p>`
            : ''
        }
        <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;"><strong>Your login details</strong></p>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">Login ID</p>
          <p style="margin: 0 0 14px 0; font-size: 16px; font-family: monospace; background: #f8fafc; padding: 10px; border-radius: 4px;">${safeLoginId}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">Gmail / Email</p>
          <p style="margin: 0 0 14px 0; font-size: 16px; font-family: monospace; background: #f8fafc; padding: 10px; border-radius: 4px;">${safeEmail}</p>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">Password</p>
          <p style="margin: 0; font-size: 16px; font-family: monospace; background: #fef3c7; padding: 10px; border-radius: 4px; color: #92400e;"><strong>${safePassword || '—'}</strong></p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${safeUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700;">Open lead form and sign in</a>
        </div>
        <p style="font-size: 13px; color: #374151; word-break: break-all;">
          Link: <a href="${safeUrl}" style="color: #2563eb;">${safeUrl}</a>
        </p>
        <p style="font-size: 14px; color: #6b7280;">Keep this password. You will need it to sign in on that page.</p>
      </div>
    </body>
    </html>
  `;
}
