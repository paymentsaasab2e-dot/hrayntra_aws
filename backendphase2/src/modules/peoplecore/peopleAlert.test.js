import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leaveDecisionMessage, notifyEmployeeWhatsApp, overtimeMessage } from './peopleAlert.js';

describe('People WhatsApp alerts', () => {
  it('writes a leave decision and an overtime punch message', () => {
    assert.match(leaveDecisionMessage({
      employeeName: 'Ada',
      status: 'APPROVED',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    }), /Ada/);
    assert.match(overtimeMessage({
      employeeName: 'Ada',
      localWorkDate: '2026-11-16',
      overtimeMinutes: 90,
    }), /1.5 overtime/);
  });

  it('does not send when WhatsApp is not configured', async () => {
    const result = await notifyEmployeeWhatsApp({ phone: '+15550001111' }, 'hello');
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'not_configured');
  });
});
