const TIMEZONE_ALIASES = {
  'GMT+5:30': 'Asia/Kolkata',
  'GMT+1:00': 'Etc/GMT-1',
  'GMT+0:00': 'UTC',
  'GMT-5:00': 'Etc/GMT+5',
  'IST GMT+5:30': 'Asia/Kolkata',
};

const normalizeTimeZone = (timezone) => {
  const raw = String(timezone || '').trim();
  if (!raw) return 'Asia/Kolkata';
  if (TIMEZONE_ALIASES[raw]) return TIMEZONE_ALIASES[raw];
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    if (/ist|kolkata|india/i.test(raw)) return 'Asia/Kolkata';
    return 'Asia/Kolkata';
  }
};

const timezoneShortLabel = (timezone) => {
  const tz = normalizeTimeZone(timezone);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const name = parts.find((part) => part.type === 'timeZoneName')?.value;
    if (name) return `${name} · ${tz}`;
  } catch {
    /* fall through */
  }
  return tz;
};

const formatDateTime = (value, timezone) => {
  const safeTimeZone = normalizeTimeZone(timezone);
  const formatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: safeTimeZone,
  }).format(new Date(value));
  return `${formatted} (${timezoneShortLabel(safeTimeZone)})`;
};

const escapeAttr = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

const layout = ({ title, intro, sections, ctaLabel, ctaLink, rsvpLinks }) => `
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
                <a href="${escapeAttr(ctaLink)}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700;">
                  ${ctaLabel || 'Join Interview'}
                </a>
              </div>`
            : ''
        }
        ${
          rsvpLinks?.acceptUrl || rsvpLinks?.rejectUrl || rsvpLinks?.rescheduleUrl
            ? `<div style="margin-top:28px; padding-top:20px; border-top:1px solid #e5e7eb;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin-bottom:12px;">Please respond</div>
                <div>
                  ${
                    rsvpLinks.acceptUrl
                      ? `<a href="${escapeAttr(rsvpLinks.acceptUrl)}" style="display:inline-block; background:#059669; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700; margin:0 8px 8px 0;">Accept</a>`
                      : ''
                  }
                  ${
                    rsvpLinks.rejectUrl
                      ? `<a href="${escapeAttr(rsvpLinks.rejectUrl)}" style="display:inline-block; background:#ffffff; color:#dc2626; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700; border:1px solid #fecaca; margin:0 8px 8px 0;">Reject</a>`
                      : ''
                  }
                  ${
                    rsvpLinks.rescheduleUrl
                      ? `<a href="${escapeAttr(rsvpLinks.rescheduleUrl)}" style="display:inline-block; background:#ffffff; color:#1d4ed8; text-decoration:none; padding:10px 16px; border-radius:10px; font-weight:700; border:1px solid #bfdbfe; margin:0 8px 8px 0;">Reschedule</a>`
                      : ''
                  }
                </div>
              </div>`
            : ''
        }
      </div>
    </div>
  </div>
`;

export const interviewScheduledTemplate = ({
  candidateName,
  jobTitle,
  companyName,
  date,
  timezone,
  meetingLink,
  panelNames,
  showJoinCta,
  rsvpLinks,
  location,
  phoneNumber,
  modeLabel,
  durationMinutes,
  roundLabel,
  title: titleOverride,
  intro: introOverride,
}) => {
  const company = String(companyName || '').trim();
  const link = String(meetingLink || '').trim();
  const hasMeetingLink = Boolean(link) && /^https?:\/\//i.test(link);
  // Always surface a real Meet/Zoom URL in the body; CTA still respects showJoinCta.
  const joinVisible = showJoinCta !== false && hasMeetingLink;

  const sections = [
    { label: 'Role', value: jobTitle },
    ...(company ? [{ label: 'Company', value: company }] : []),
    { label: 'Date & Time', value: formatDateTime(date, timezone) },
    ...(roundLabel ? [{ label: 'Round', value: roundLabel }] : []),
    ...(Number(durationMinutes) > 0 ? [{ label: 'Duration', value: `${Number(durationMinutes)} minutes` }] : []),
    ...(modeLabel ? [{ label: 'Interview Mode', value: modeLabel }] : []),
    { label: 'Interviewers', value: (panelNames || []).filter(Boolean).join(', ') || 'HRYANTRA Hiring Team' },
  ];

  if (hasMeetingLink) {
    sections.push({
      label: 'Meeting Link',
      value: `<a href="${escapeAttr(link)}" style="color:#2563eb; word-break:break-all;">${escapeAttr(link)}</a>`,
    });
  } else if (location) {
    sections.push({ label: 'Location', value: location });
  } else if (phoneNumber) {
    sections.push({ label: 'Phone', value: phoneNumber });
  }

  return layout({
    title:
      titleOverride ||
      (company ? `Interview Scheduled: ${jobTitle} at ${company}` : `Interview Scheduled: ${jobTitle}`),
    intro:
      introOverride ||
      `Hello ${candidateName}, your interview has been scheduled. Please review the details below${
        hasMeetingLink ? ' and join on time' : ''
      }.`,
    sections,
    ctaLabel: 'Join Interview',
    ctaLink: joinVisible ? link : null,
    rsvpLinks,
  });
};

export const interviewRescheduledTemplate = ({
  candidateName,
  jobTitle,
  companyName,
  oldDate,
  newDate,
  timezone,
  reason,
  meetingLink,
  showJoinCta,
  rsvpLinks,
}) => {
  const company = String(companyName || '').trim();
  const link = String(meetingLink || '').trim();
  const hasMeetingLink = Boolean(link) && /^https?:\/\//i.test(link);
  const joinVisible = showJoinCta !== false && hasMeetingLink;
  return layout({
    title: company ? `Interview Rescheduled: ${jobTitle} at ${company}` : `Interview Rescheduled: ${jobTitle}`,
    intro: `Hello ${candidateName}, your interview schedule has been updated.`,
    sections: [
      { label: 'Role', value: jobTitle },
      { label: 'Old Schedule', value: formatDateTime(oldDate, timezone) },
      { label: 'New Schedule', value: formatDateTime(newDate, timezone) },
      { label: 'Reason', value: reason || 'Updated by recruiting team' },
      ...(hasMeetingLink
        ? [
            {
              label: 'Meeting Link',
              value: `<a href="${escapeAttr(link)}" style="color:#2563eb; word-break:break-all;">${escapeAttr(link)}</a>`,
            },
          ]
        : []),
    ],
    ctaLabel: 'View Updated Meeting',
    ctaLink: joinVisible ? link : null,
    rsvpLinks,
  });
};

export const interviewCancelledTemplate = ({ candidateName, jobTitle, companyName, reason }) => {
  const company = String(companyName || '').trim();
  return layout({
    title: company ? `Interview Cancelled: ${jobTitle} at ${company}` : `Interview Cancelled: ${jobTitle}`,
    intro: `Hello ${candidateName}, your scheduled interview has been cancelled.`,
    sections: [
      { label: 'Role', value: jobTitle },
      ...(company ? [{ label: 'Company', value: company }] : []),
      { label: 'Reason', value: reason || 'Cancelled by recruiting team' },
      { label: 'Next Step', value: 'Our team will reach out if a new slot becomes available.' },
    ],
  });
};

export const feedbackReminderTemplate = ({ interviewerName, candidateName, date, timezone, feedbackUrl }) =>
  layout({
    title: 'Feedback Reminder',
    intro: `Hello ${interviewerName}, please submit feedback for ${candidateName}.`,
    sections: [{ label: 'Interview Time', value: formatDateTime(date, timezone) }],
    ctaLabel: 'Submit Feedback',
    ctaLink: feedbackUrl,
  });
