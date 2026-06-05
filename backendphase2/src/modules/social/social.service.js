import { linkedinService } from '../linkedin/linkedin.service.js';
import { integrationService } from '../integration/integration.service.js';
import { dbLogger } from '../../utils/db-logger.js';

export const socialService = {
  /**
   * Post a job to all selected platforms and accounts
   */
  async publishJob(userId, jobId, platforms, jobData) {
    const results = {};

    if (platforms.linkedin) {
      try {
        const targets =
          Array.isArray(jobData.linkedinTargets) && jobData.linkedinTargets.length
            ? jobData.linkedinTargets
            : null;
        results.linkedin = await linkedinService.postJob(
          userId,
          {
            jobTitle: jobData.title,
            company: jobData.companyName,
            description: jobData.description,
            applyUrl: jobData.applyUrl,
            location: jobData.location,
            postText: jobData.linkedinPostText,
          },
          targets
        );
      } catch (error) {
        results.linkedin = { success: false, error: error.message };
      }
    }

    if (platforms.twitter) {
      const selected =
        Array.isArray(jobData.twitterTargets) && jobData.twitterTargets.length
          ? jobData.twitterTargets
          : (await integrationService.getProviderAccounts(userId, 'twitter')).map((a) => a.id);

      const twitterResults = [];
      for (const connectionId of selected) {
        twitterResults.push({
          success: true,
          connectionId,
          url: 'https://twitter.com/placeholder',
          message: 'Post simulated (Requires Twitter API setup)',
        });
      }

      results.twitter = {
        success: twitterResults.length > 0,
        results: twitterResults,
        url: twitterResults[0]?.url,
        message: twitterResults[0]?.message,
      };
    }

    if (platforms.facebook) {
      results.facebook = {
        success: true,
        url: 'https://facebook.com/placeholder',
        message: 'Post simulated (Requires Facebook App setup)',
      };
    }

    dbLogger.logUpdate('JOB_SOCIAL_PUBLISH', jobId, results);

    return results;
  },
};
