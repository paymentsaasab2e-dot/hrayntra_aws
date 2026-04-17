const formatDateTime = (value, timezone) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'UTC',
  }).format(new Date(value));

const layout = ({ title, intro, sections, ctaLabel, ctaLink }) => `
  <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#111827;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
      <div style="background:#2563eb; color:#ffffff; padding:24px;">
        <h1 style="margin:0; font-size:24px;">${title}</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px; line-height:1.6; margin-top:0;">${intro}</p>
        ${sections
          .map(
            ({ label, value }) => `
              <div style="padding:12px 0; border-bottom:1px solid #f3f4f6;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280;">${label}</div>
                <div style="margin-top:4px; font-size:15px; color:#111827;">${value}</div>
              </div>
            `
          )
          .join('')}
        ${
          ctaLink
            ? `<div style="margin-top:24px;">
                <a href="${ctaLink}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700;">
                  ${ctaLabel}
                </a>
              </div>`
            : ''
        }
      </div>
    </div>
  </div>
`;

export const interviewScheduledTemplate = ({ candidateName, jobTitle, companyName, date, timezone, meetingLink, panelNames }) =>
  layout({
    title: `Interview Scheduled: ${jobTitle} at ${companyName}`,
    intro: `Hello ${candidateName}, your interview has been scheduled. Please review the details below and join on time.`,
    sections: [
      { label: 'Role', value: jobTitle },
      { label: 'Company', value: companyName },
      { label: 'Date & Time', value: formatDateTime(date, timezone) },
      { label: 'Interviewers', value: panelNames.join(', ') || 'SAASA Hiring Team' },
      { label: 'Meeting Link', value: meetingLink || 'Your recruiter will share the meeting link shortly.' },
    ],
    ctaLabel: 'Join Interview',
    ctaLink: meetingLink,
  });

export const interviewRescheduledTemplate = ({
  candidateName,
  jobTitle,
  companyName,
  oldDate,
  newDate,
  timezone,
  reason,
  meetingLink,
}) =>
  layout({
    title: `Interview Rescheduled: ${jobTitle} at ${companyName}`,
    intro: `Hello ${candidateName}, your interview schedule has been updated.`,
    sections: [
      { label: 'Old Schedule', value: formatDateTime(oldDate, timezone) },
      { label: 'New Schedule', value: formatDateTime(newDate, timezone) },
      { label: 'Reason', value: reason || 'Updated by recruiting team' },
      { label: 'Meeting Link', value: meetingLink || 'The updated meeting link will be shared shortly.' },
    ],
    ctaLabel: 'View Updated Meeting',
    ctaLink: meetingLink,
  });

export const interviewCancelledTemplate = ({ candidateName, jobTitle, companyName, reason }) =>
  layout({
    title: `Interview Cancelled: ${jobTitle} at ${companyName}`,
    intro: `Hello ${candidateName}, your scheduled interview has been cancelled.`,
    sections: [
      { label: 'Role', value: jobTitle },
      { label: 'Company', value: companyName },
      { label: 'Reason', value: reason || 'Cancelled by recruiting team' },
      { label: 'Next Step', value: 'Our team will reach out if a new slot becomes available.' },
    ],
  });

export const feedbackReminderTemplate = ({ interviewerName, candidateName, date, timezone, feedbackUrl }) =>
  layout({
    title: `Reminder: Submit Feedback for ${candidateName}`,
    intro: `Hello ${interviewerName}, please submit your interview feedback to keep the hiring process moving.`,
    sections: [
      { label: 'Candidate', value: candidateName },
      { label: 'Interview Time', value: formatDateTime(date, timezone) },
    ],
    ctaLabel: 'Submit Feedback',
    ctaLink: feedbackUrl,
  });
