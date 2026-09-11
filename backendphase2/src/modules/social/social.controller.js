import { sendResponse, sendError } from '../../utils/response.js';
import { socialService } from './social.service.js';
import { integrationService } from '../integration/integration.service.js';
import { linkedinService } from '../linkedin/linkedin.service.js';
import { prisma } from '../../config/prisma.js';

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
        linkedinImageUrl,
        imageUrl,
      } = req.body;

      // Prefer request fields; fall back to the saved job so LinkedIn never loses
      // title / company / location when an older client blanked them via Public Visibility.
      let resolvedTitle = String(title || '').trim();
      let resolvedCompany = String(companyName || '').trim();
      let resolvedLocation = String(location || '').trim();
      let resolvedDescription = String(description || '').trim();

      if (
        jobId &&
        (!resolvedTitle || !resolvedCompany || !resolvedLocation || !resolvedDescription)
      ) {
        try {
          const job = await prisma.job.findUnique({
            where: { id: String(jobId) },
            select: {
              title: true,
              description: true,
              location: true,
              overview: true,
              postingCompanyName: true,
              showClientNamePublicly: true,
              client: { select: { companyName: true } },
            },
          });
          if (!resolvedTitle) resolvedTitle = String(job?.title || '').trim();
          if (!resolvedCompany) {
            // Same agency rule: posting/agency name first; real client only when allowed.
            const posted = String(job?.postingCompanyName || '').trim();
            const allowClient =
              showClientNamePublicly !== false && job?.showClientNamePublicly !== false;
            resolvedCompany =
              posted || (allowClient ? String(job?.client?.companyName || '').trim() : '');
          }
          if (!resolvedLocation) resolvedLocation = String(job?.location || '').trim();
          if (!resolvedDescription) {
            resolvedDescription = String(job?.overview || job?.description || '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 500);
          }
        } catch {
          /* ignore — validation below will catch empty title */
        }
      }

      if (!jobId || !resolvedTitle || !applyUrl) {
        return sendError(res, 400, 'Job ID, title, and apply URL are required');
      }

      const postData = {
        title: resolvedTitle,
        companyName: resolvedCompany,
        // Keep flag for platforms that still care; display name is already resolved.
        showClientNamePublicly: showClientNamePublicly !== false,
        description: resolvedDescription || undefined,
        applyUrl,
        location: resolvedLocation || undefined,
        linkedinPostText,
        twitterPostText,
        facebookPostText,
        linkedinTargets: Array.isArray(linkedinTargets) ? linkedinTargets : [],
        twitterTargets: Array.isArray(twitterTargets) ? twitterTargets : [],
        linkedinImageUrl: linkedinImageUrl || imageUrl || '',
        imageUrl: linkedinImageUrl || imageUrl || '',
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
