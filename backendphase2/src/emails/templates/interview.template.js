export const interviewTemplate = (candidateName, jobTitle, scheduledAt, location, meetingLink) => {
  const date = new Date(scheduledAt).toLocaleString();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Interview Scheduled</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Interview Scheduled</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">Hello ${candidateName},</h2>
        <p>Your interview has been scheduled:</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Position:</strong> ${jobTitle}</p>
          <p><strong>Date & Time:</strong> ${date}</p>
          ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
          ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
        </div>
        <p>Please confirm your availability or contact us if you need to reschedule.</p>
      </div>
    </body>
    </html>
  `;
};
