import { prisma } from '../../config/prisma.js';

/**
 * ARIA v3.2 Undo Engine Service
 * Manages the persistent 10-minute undo stack for AI-driven operations.
 */
export const undoService = {
  /**
   * Save a snapshot of an action to the undo stack.
   * @param {Object} params
   * @param {string} params.actionId - Unique ID for the action (sent to frontend)
   * @param {string} params.userId - User who performed the action
   * @param {string} params.module - CRM module (Leads, Clients, etc.)
   * @param {string} params.action - Type of action performed (CREATE, UPDATE, etc.)
   * @param {string} params.endpoint - The API endpoint to hit for reversal
   * @param {string} params.method - The HTTP method for reversal
   * @param {Array<string>} params.targetIds - IDs of records affected
   * @param {Object} [params.reverseData] - Data needed for reversal (e.g. old values)
   * @param {Object} [params.uiReverse] - Frontend state reversal hints
   * @param {number} [params.expiryMinutes=10] - How long the undo is valid
   */
  async pushToStack({
    actionId,
    userId,
    module,
    action,
    endpoint,
    method,
    targetIds,
    reverseData = {},
    uiReverse = {},
    expiryMinutes = 10,
  }) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

      const undo = await prisma.undo.create({
        data: {
          actionId,
          userId,
          module,
          action,
          endpoint,
          method,
          targetIds,
          reverseData,
          uiReverse,
          expiresAt,
        },
      });

      return undo;
    } catch (error) {
      console.error('[undoService.pushToStack] Error:', error);
      return null;
    }
  },

  /**
   * Retrieve a valid undo record from the stack.
   * @param {string} actionId 
   * @returns {Promise<Object|null>}
   */
  async getValidUndo(actionId) {
    try {
      const undo = await prisma.undo.findUnique({
        where: { actionId },
      });

      if (!undo) return null;

      // Check if expired
      if (new Date() > new Date(undo.expiresAt)) {
        await this.removeFromStack(actionId);
        return null;
      }

      return undo;
    } catch (error) {
      console.error('[undoService.getValidUndo] Error:', error);
      return null;
    }
  },

  /**
   * Delete an undo record from the stack.
   * @param {string} actionId 
   */
  async removeFromStack(actionId) {
    try {
      await prisma.undo.delete({
        where: { actionId },
      });
    } catch (error) {
      // Ignore if already deleted
    }
  },

  /**
   * Cleanup expired undo records. (Can be called via CRON)
   */
  async cleanupExpired() {
    try {
      const result = await prisma.undo.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      return result.count;
    } catch (error) {
      console.error('[undoService.cleanupExpired] Error:', error);
      return 0;
    }
  },
};
