function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detailRow(label, value) {
  if (!value) return '';
  return `<p style="margin:8px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

/** Email to candidate when recruiter schedules joining. */
export const joiningScheduledCandidateTemplate = ({
  candidateName,
  jobTitle,
  companyName,
  joiningDateLabel,
  reportingToName,
  reportingToTitle,
  reportingToEmail,
  joiningNotes,
  recruiterName,
  recruiterEmail,
}) => {
  const reportToLine = [
    reportingToName,
    reportingToTitle ? `(${reportingToTitle})` : '',
    reportingToEmail ? `— ${reportingToEmail}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Joining Scheduled</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 28px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Your joining date is scheduled</h1>
      </div>
      <div style="background: #fffbeb; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #fde68a;">
        <p style="margin-top: 0;">Hello ${escapeHtml(candidateName)},</p>
        <p>Your joining has been scheduled for the role below. Please review the details and report on the date mentioned.</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #fde68a;">
          ${detailRow('Position', jobTitle)}
          ${detailRow('Company', companyName)}
          ${detailRow('Joining date', joiningDateLabel)}
          ${reportToLine ? detailRow('Report to', reportToLine) : ''}
          ${joiningNotes ? `<p style="margin:12px 0 0;"><strong>Instructions:</strong></p><p style="margin:4px 0; white-space:pre-wrap;">${escapeHtml(joiningNotes)}</p>` : ''}
        </div>
        ${recruiterName || recruiterEmail ? `<p>If you have questions, contact your recruiter${recruiterName ? ` <strong>${escapeHtml(recruiterName)}</strong>` : ''}${recruiterEmail ? ` at <a href="mailto:${escapeHtml(recruiterEmail)}">${escapeHtml(recruiterEmail)}</a>` : ''}.</p>` : ''}
        <p style="margin-bottom: 0;">You can also view this update on your candidate portal application.</p>
      </div>
    </body>
    </html>
  `;
};

/** Email to company reporting contact with candidate details for joining day. */
export const joiningScheduledReportingContactTemplate = ({
  recipientName,
  candidateName,
  candidateEmail,
  candidatePhone,
  candidateLocation,
  currentTitle,
  currentCompany,
  jobTitle,
  companyName,
  joiningDateLabel,
  joiningNotes,
  recruiterName,
  recruiterEmail,
}) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Candidate joining scheduled</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 28px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Candidate joining scheduled</h1>
      </div>
      <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <p style="margin-top: 0;">Hello ${escapeHtml(recipientName || 'there')},</p>
        <p>The following candidate is scheduled to join your organization. Their details are below for your reference.</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Joining</h3>
          ${detailRow('Joining date', joiningDateLabel)}
          ${detailRow('Role', jobTitle)}
          ${detailRow('Company', companyName)}
          <h3 style="margin: 20px 0 12px; color: #111827; font-size: 16px;">Candidate</h3>
          ${detailRow('Name', candidateName)}
          ${detailRow('Email', candidateEmail)}
          ${detailRow('Phone', candidatePhone)}
          ${detailRow('Location', candidateLocation)}
          ${detailRow('Current title', currentTitle)}
          ${detailRow('Current company', currentCompany)}
          ${joiningNotes ? `<p style="margin:12px 0 0;"><strong>Notes from recruiter:</strong></p><p style="margin:4px 0; white-space:pre-wrap;">${escapeHtml(joiningNotes)}</p>` : ''}
        </div>
        ${recruiterName || recruiterEmail ? `<p>Recruiter contact: ${recruiterName ? `<strong>${escapeHtml(recruiterName)}</strong>` : ''}${recruiterEmail ? ` — <a href="mailto:${escapeHtml(recruiterEmail)}">${escapeHtml(recruiterEmail)}</a>` : ''}</p>` : ''}
        <p style="margin-bottom: 0;">Please ensure the candidate is welcomed and onboarded on the scheduled date.</p>
      </div>
    </body>
    </html>
  `;

export const placementTemplate = (candidateName, jobTitle, startDate, companyName) => {
  const date = new Date(startDate).toLocaleDateString();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Placement Confirmed</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 Placement Confirmed!</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">Congratulations ${candidateName}!</h2>
        <p>We're excited to inform you that your placement has been confirmed:</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Position:</strong> ${jobTitle}</p>
          <p><strong>Company:</strong> ${companyName}</p>
          <p><strong>Start Date:</strong> ${date}</p>
        </div>
        <p>We wish you all the best in your new role!</p>
      </div>
    </body>
    </html>
  `;
};
