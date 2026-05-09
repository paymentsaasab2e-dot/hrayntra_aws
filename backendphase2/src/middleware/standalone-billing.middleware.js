import { sendError } from '../utils/response.js';
import { getRecruitmentMode } from '../modules/setting/recruitmentMode.service.js';

/**
 * Block billing API for standalone orgs (product billing not used in that mode).
 * Mounted on billing router after authMiddleware.
 */
export async function blockBillingForStandaloneOrg(req, res, next) {
  try {
    const mode = await getRecruitmentMode();
    if (mode === 'standalone') {
      return sendError(
        res,
        403,
        'Billing is not available for standalone organizations. Switch recruitment mode to Agency in Settings if you need billing.',
      );
    }
    return next();
  } catch (err) {
    return sendError(res, 500, err?.message || 'Billing access check failed', err);
  }
}
