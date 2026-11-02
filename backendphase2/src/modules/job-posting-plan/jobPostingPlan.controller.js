import { sendResponse, sendError } from '../../utils/response.js';
import {
  ensureFreePlanIfMissing,
  getJobPostingQuotaSnapshot,
  getPremiumOffer,
  createPremiumPaymentOrder,
  activatePremium,
} from './jobPostingPlan.service.js';

export const jobPostingPlanController = {
  async getStatus(req, res) {
    try {
      await ensureFreePlanIfMissing();
      const snapshot = await getJobPostingQuotaSnapshot();
      const offer = getPremiumOffer();
      sendResponse(res, 200, 'OK', { snapshot, offer });
    } catch (error) {
      sendError(res, 500, error.message || 'Failed to load job posting plan', error);
    }
  },

  async createPaymentOrder(req, res) {
    try {
      const { billingCycle } = req.body || {};
      const order = await createPremiumPaymentOrder({
        billingCycle,
        userEmail: req.user?.email,
      });
      sendResponse(res, 200, 'Payment order created', order);
    } catch (error) {
      sendError(res, 400, error.message || 'Failed to create payment order', error);
    }
  },

  async activate(req, res) {
    try {
      const {
        billingCycle,
        paymentReference,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body || {};
      const result = await activatePremium({
        billingCycle,
        paymentReference,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        activatedBy: req.user?.email || req.user?.id,
      });
      sendResponse(res, 200, 'Premium job posting activated', result);
    } catch (error) {
      sendError(res, 400, error.message || 'Failed to activate Premium', error);
    }
  },
};
