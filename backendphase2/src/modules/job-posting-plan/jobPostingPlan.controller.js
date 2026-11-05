import { sendResponse, sendError } from '../../utils/response.js';
import {
  ensureFreePlanIfMissing,
  getJobPostingQuotaSnapshot,
  getPremiumOfferWithPacks,
  createPremiumPaymentOrder,
  activatePremium,
} from './jobPostingPlan.service.js';

export const jobPostingPlanController = {
  async getStatus(req, res) {
    try {
      await ensureFreePlanIfMissing();
      const snapshot = await getJobPostingQuotaSnapshot();
      const offer = await getPremiumOfferWithPacks();
      sendResponse(res, 200, 'OK', { snapshot, offer, packs: offer.packs || [] });
    } catch (error) {
      sendError(res, 500, error.message || 'Failed to load job posting plan', error);
    }
  },

  async createPaymentOrder(req, res) {
    try {
      const { billingCycle, packId } = req.body || {};
      const order = await createPremiumPaymentOrder({
        billingCycle,
        packId,
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
        packId,
        paymentReference,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body || {};
      const result = await activatePremium({
        billingCycle,
        packId,
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
