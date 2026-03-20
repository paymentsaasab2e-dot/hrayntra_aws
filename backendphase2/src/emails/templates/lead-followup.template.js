export const leadFollowUpTemplate = (companyName, followUpDate, followUpType, notes) => {
  const dateString = new Date(followUpDate).toLocaleString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Follow-up Scheduled</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 24px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Follow-up Scheduled</h1>
      </div>
      <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <p style="margin-top: 0;">A follow-up has been scheduled for lead <strong>${companyName}</strong>.</p>
        <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Type:</strong> ${followUpType || 'General follow-up'}</p>
          <p><strong>Date & Time:</strong> ${dateString}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        </div>
        <p style="font-size: 14px; color: #6b7280;">This is an automated notification from your SAASA leads workspace.</p>
      </div>
    </body>
    </html>
  `;
};

