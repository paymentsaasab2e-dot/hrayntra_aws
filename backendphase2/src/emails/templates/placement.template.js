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
