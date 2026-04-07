import { sendResponse, sendError } from '../../utils/response.js';
import { socialService } from './social.service.js';
import { env } from '../../config/env.js';

export const socialController = {
  /**
   * Post a job across multiple social platforms
   */
  async publishJobPost(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      const {
        jobId,
        title,
        companyName,
        description,
        applyUrl,
        location,
        platforms, // { linkedin: bool, twitter: bool, facebook: bool }
        linkedinPostText,
        twitterPostText,
        facebookPostText
      } = req.body;

      if (!jobId || !title || !companyName || !applyUrl) {
        return sendError(res, 400, 'Job ID, title, company name, and apply URL are required');
      }

      const postData = {
        title,
        companyName,
        description,
        applyUrl,
        location,
        linkedinPostText,
        twitterPostText,
        facebookPostText
      };

      const result = await socialService.publishJob(req.user.id, jobId, platforms, postData);

      sendResponse(res, 200, 'Social publishing initiated', result);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  /**
   * Status check for all social connections
   */
  async getStatus(req, res) {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Authentication required');
      }

      // LinkedIn status is handled by LinkedIn controller for now
      // Placeholder for other platform statuses
      const status = {
        twitter: { connected: !!env.TWITTER_API_KEY && !!env.TWITTER_API_SECRET },
        facebook: { connected: !!env.FACEBOOK_APP_ID && !!env.FACEBOOK_APP_SECRET }
      };

      sendResponse(res, 200, 'Social connections status', status);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  }
};
