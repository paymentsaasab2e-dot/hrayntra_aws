/**
 * Email Templates for Resend
 * 
 * These templates are defined here and should be created in Resend dashboard.
 * Template IDs are stored in environment variables.
 */

const EmailTemplateType = {
  AUTH_OTP: 'auth-otp',
  AUTH_WELCOME: 'auth-welcome',
  AUTH_RESET_PASSWORD: 'auth-reset-password',
  // Add more template types as needed
};

/**
 * Get template ID from environment variable
 * @param {string} templateType - Template type from EmailTemplateType
 * @returns {string} Template ID
 */
function getTemplateId(templateType) {
  const templateMap = {
    [EmailTemplateType.AUTH_OTP]: process.env.RESEND_TEMPLATE_AUTH_OTP || 'auth-otp',
    [EmailTemplateType.AUTH_WELCOME]: process.env.RESEND_TEMPLATE_AUTH_WELCOME || 'auth-welcome',
    [EmailTemplateType.AUTH_RESET_PASSWORD]: process.env.RESEND_TEMPLATE_AUTH_RESET_PASSWORD || 'auth-reset-password',
  };

  return templateMap[templateType];
}

/**
 * Template variable mappings for each template type
 * @param {string} templateType - Template type from EmailTemplateType
 * @param {Object} data - Template data
 * @returns {Object} Template variables
 */
function getTemplateVariables(templateType, data) {
  switch (templateType) {
    case EmailTemplateType.AUTH_OTP:
      return {
        otp: data.otp,
        whatsappNumber: data.whatsappNumber,
        expiresInMinutes: data.expiresInMinutes || 5,
        supportEmail: data.supportEmail || 'support@saasab2e.com',
        companyName: 'SAASA B2E',
        year: new Date().getFullYear(),
      };

    case EmailTemplateType.AUTH_WELCOME:
      return {
        userName: data.userName || 'User',
        companyName: 'SAASA B2E',
        year: new Date().getFullYear(),
      };

    case EmailTemplateType.AUTH_RESET_PASSWORD:
      return {
        resetLink: data.resetLink,
        expiresInMinutes: data.expiresInMinutes || 15,
        companyName: 'SAASA B2E',
        year: new Date().getFullYear(),
      };

    default:
      return {};
  }
}

module.exports = {
  EmailTemplateType,
  getTemplateId,
  getTemplateVariables,
};
