function generateJobRecommendationEmailHTML(data) {
  const {
    candidateName = 'there',
    jobTitle = 'New role',
    companyName = 'Hiring company',
    matchScore = 80,
    jobUrl = '#',
    supportEmail = 'support@saasab2e.com',
    year = new Date().getFullYear(),
  } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Job recommendation</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 28px 12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">AI job recommendation</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;">We recommend this job for you</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${candidateName},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                A newly posted role is a strong fit for your profile. Our AI CV fit analysis shows
                <strong>${matchScore}% match</strong> for this opportunity.
              </p>
              <div style="margin:0 0 20px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Recommended job</p>
                <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${jobTitle}</p>
                <p style="margin:6px 0 0;font-size:14px;color:#475569;">${companyName}</p>
              </div>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                This looks like one of your best-fitted openings right now. Kindly review the role and apply if it aligns with your goals.
              </p>
              <a href="${jobUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
                View &amp; apply now
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                You received this because job alerts are enabled on your HRYANTRA account.
                Questions? Contact ${supportEmail}.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#cbd5e1;">© ${year} HRYANTRA</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateJobRecommendationEmailText(data) {
  const {
    candidateName = 'there',
    jobTitle = 'New role',
    companyName = 'Hiring company',
    matchScore = 80,
    jobUrl = '#',
    supportEmail = 'support@saasab2e.com',
  } = data;

  return `Hi ${candidateName},

We recommend this job for you.

Our AI CV fit analysis shows ${matchScore}% match for:
${jobTitle} at ${companyName}

This is one of your best-fitted openings right now. Kindly review the role and apply if it aligns with your goals.

View and apply: ${jobUrl}

You received this because job alerts are enabled on your HRYANTRA account.
Questions? Contact ${supportEmail}.`;
}

module.exports = {
  generateJobRecommendationEmailHTML,
  generateJobRecommendationEmailText,
};
