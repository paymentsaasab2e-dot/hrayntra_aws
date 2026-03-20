export const welcomeTemplate = (name, email) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to SAASA Recruitment</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to SAASA Recruitment</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">Hello ${name}!</h2>
        <p>Welcome to SAASA Recruitment Platform. Your account has been successfully created.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>You can now log in and start managing your recruitment pipeline.</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000'}/login" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login Now</a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you have any questions, feel free to contact our support team.</p>
      </div>
    </body>
    </html>
  `;
};
