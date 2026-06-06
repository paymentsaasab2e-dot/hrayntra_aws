import { linkedinService } from '../linkedin/linkedin.service.js';
import { twitterService } from '../twitter/twitter.service.js';
import { dbLogger } from '../../utils/db-logger.js';

export const socialService = {
  /**
   * Post a job to all selected platforms and accounts
   */
  async publishJob(userId, jobId, platforms, jobData) {
    const results = {};
    const jobTitle = String(jobData.title || '').trim();
    const companyName = String(jobData.companyName || '').trim();

    console.log('[social] Publishing job to social platforms', {
      jobId,
      userId,
      jobTitle: jobTitle || undefined,
      companyName: companyName || undefined,
      platforms,
    });

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
        console.error('[social] LinkedIn job publish failed', { jobId, error: error.message });
      }
    }

    if (results.linkedin?.success) {
      console.log('[social] Job posted to LinkedIn successfully', {
        jobId,
        jobTitle: jobTitle || undefined,
        url: results.linkedin.linkedinPostUrl,
        postId: results.linkedin.postId,
      });
    }

    if (platforms.twitter) {
      try {
        results.twitter = await twitterService.postJob(
          userId,
          {
            title: jobData.title,
            companyName: jobData.companyName,
            description: jobData.description,
            applyUrl: jobData.applyUrl,
            location: jobData.location,
            twitterPostText: jobData.twitterPostText,
          },
          jobData.twitterTargets?.length ? jobData.twitterTargets : null,
        );
      } catch (error) {
        results.twitter = { success: false, error: error.message };
        console.error('[social] X job publish failed', { jobId, error: error.message });
      }
    }

    if (results.twitter?.success) {
      console.log('[social] Job posted to X successfully', {
        jobId,
        jobTitle: jobTitle || undefined,
        companyName: companyName || undefined,
        url: results.twitter.url,
        tweetId: results.twitter.tweetId,
        accountsPosted: results.twitter.results?.filter((entry) => entry.success).length || 1,
      });
    }

    if (platforms.facebook) {
      results.facebook = {
        success: true,
        url: 'https://facebook.com/placeholder',
        message: 'Post simulated (Requires Facebook App setup)',
      };
    }

    dbLogger.logUpdate('JOB_SOCIAL_PUBLISH', jobId, results);

    const succeeded = Object.entries(results)
      .filter(([, value]) => value?.success)
      .map(([platform]) => platform);
    const failed = Object.entries(results)
      .filter(([, value]) => value && !value.success)
      .map(([platform, value]) => ({ platform, error: value.error }));

    if (succeeded.length) {
      console.log('[social] Job social publish summary — success', {
        jobId,
        jobTitle: jobTitle || undefined,
        succeeded,
        failed: failed.length ? failed : undefined,
      });
    } else if (failed.length) {
      console.error('[social] Job social publish summary — all failed', { jobId, failed });
    }

    return results;
  },
};
