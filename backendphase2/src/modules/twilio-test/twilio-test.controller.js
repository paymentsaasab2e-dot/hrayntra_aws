import twilio from 'twilio';
import { sendResponse } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';
import { ensurePreferences } from '../user-communication/user-communication.service.js';

function decryptToken(stored) {
  if (!stored) return '';
  return encryption.decryptColonString(String(stored));
}

export const twilioTestController = {
  async test(req, res) {
    try {
      await ensurePreferences(req.user.id, { email: req.user.email });
      const prefs = await prisma.userCommunicationPreferences.findUnique({
        where: { userId: req.user.id },
      });
      if (!prefs?.twilioAccountSid || !prefs.twilioAuthToken) {
        return sendResponse(res, 200, 'Twilio test skipped', {
          success: false,
          error: 'Twilio Account SID and Auth Token are required',
        });
      }
      const fromNum = env.TWILIO_PHONE_NUMBER;
      if (!fromNum) {
        return sendResponse(res, 200, 'Twilio test skipped', {
          success: false,
          error: 'TWILIO_PHONE_NUMBER is not set on the server',
        });
      }
      const token = decryptToken(prefs.twilioAuthToken);
      if (!token) {
        return sendResponse(res, 200, 'Twilio test failed', {
          success: false,
          error: 'Could not read Twilio auth token',
        });
      }
      const client = twilio(prefs.twilioAccountSid, token);
      await client.messages.create({
        to: '+15005550006',
        from: fromNum,
        body: 'Job portal Twilio test (magic test number)',
      });
      sendResponse(res, 200, 'Twilio connection verified', {
        success: true,
        message: 'Twilio connection verified',
      });
    } catch (e) {
      sendResponse(res, 200, 'Twilio test failed', {
        success: false,
        error: e.message || 'Twilio test failed',
      });
    }
  },
};
