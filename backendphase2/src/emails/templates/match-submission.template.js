export const matchSubmissionTemplate = ({
  clientName,
  jobTitle,
  recruiterName,
  message,
  candidates,
  portalUrl,
}) => {
  const candidateCards = candidates
    .map(
      (candidate) => `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 12px;">
          <div style="font-size: 16px; font-weight: 700; color: #111827;">${candidate.name}</div>
          <div style="margin-top: 6px; font-size: 14px; color: #4b5563;">
            ${candidate.currentTitle || 'Candidate'}${candidate.currentCompany ? ` • ${candidate.currentCompany}` : ''}
          </div>
          <div style="margin-top: 10px; font-size: 14px; color: #374151;">
            <div><strong>Experience:</strong> ${candidate.experience || 0} years</div>
            <div><strong>Location:</strong> ${candidate.location || 'Not shared'}</div>
            <div><strong>Skills:</strong> ${(candidate.skills || []).slice(0, 6).join(', ') || 'Not shared'}</div>
            <div><strong>Email:</strong> ${candidate.email || 'Not shared'}</div>
            <div><strong>Phone:</strong> ${candidate.phone || 'Not shared'}</div>
          </div>
        </div>
      `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Candidate Submission</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 680px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px; text-align: center; border-radius: 14px 14px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Candidate Submission</h1>
        <p style="color: #dbeafe; margin: 8px 0 0;">${jobTitle}</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 14px 14px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; margin-top: 0;">Hello ${clientName || 'Team'},</h2>
        <p>${message || `Please review the following candidate${candidates.length > 1 ? 's' : ''} for ${jobTitle}.`}</p>

        <div style="margin: 24px 0;">
          ${candidateCards}
        </div>

        ${
          portalUrl
            ? `<div style="margin: 28px 0;">
                <a href="${portalUrl}" style="background: #2563eb; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
                  Review in Portal
                </a>
              </div>`
            : ''
        }

        <p style="margin-bottom: 0;">Regards,<br /><strong>${recruiterName || 'Recruitment Team'}</strong></p>
      </div>
    </body>
    </html>
  `;
};
