import { sendResponse, sendError } from '../../utils/response.js';
import { socialService } from './social.service.js';
import { integrationService } from '../integration/integration.service.js';
import { linkedinService } from '../linkedin/linkedin.service.js';

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
        platforms,
        linkedinPostText,
        twitterPostText,
        facebookPostText,
        linkedinTargets,
        twitterTargets,
        showClientNamePublicly,
      } = req.body;

      if (!jobId || !title || !applyUrl) {
        return sendError(res, 400, 'Job ID, title, and apply URL are required');
      }

      const postData = {
        title,
        companyName: showClientNamePublicly === false ? '' : companyName,
        showClientNamePublicly: showClientNamePublicly !== false,
        description,
        applyUrl,
        location,
        linkedinPostText,
        twitterPostText,
        facebookPostText,
        linkedinTargets: Array.isArray(linkedinTargets) ? linkedinTargets : [],
        twitterTargets: Array.isArray(twitterTargets) ? twitterTargets : [],
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

      const integrationStatuses = await integrationService.getStatuses(req.user.id);
      const linkedinStatus = await linkedinService.getStatus(req.user.id);
      const linkedinAccounts = linkedinStatus.accounts || (await linkedinService.listAccounts(req.user.id));

      const status = {
        linkedin: {
          connected: !!linkedinStatus.connected,
          accountName: linkedinStatus.name,
          accounts: linkedinAccounts,
        },
        twitter: {
          connected: !!integrationStatuses.twitter?.connected,
          accountName: integrationStatuses.twitter?.accountName,
          accountEmail: integrationStatuses.twitter?.accountEmail,
          accounts: integrationStatuses.twitter?.accounts || [],
        },
        facebook: {
          connected: !!integrationStatuses.facebook?.connected,
          accountName: integrationStatuses.facebook?.accountName,
          accountEmail: integrationStatuses.facebook?.accountEmail,
          accounts: integrationStatuses.facebook?.accounts || [],
        },
      };

      sendResponse(res, 200, 'Social connections status', status);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
