function normalizeRoomId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseSlotStart(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return null;

  const dashFormat = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(raw);
  if (dashFormat) {
    const hour = Number(dashFormat[1]);
    const minute = Number(dashFormat[2]);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }

  const amPmRange = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.exec(raw);
  if (amPmRange) {
    let hour = Number(amPmRange[1]);
    const minute = Number(amPmRange[2]);
    const period = String(amPmRange[3]).toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }

  const single24 = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (single24) {
    const hour = Number(single24[1]);
    const minute = Number(single24[2]);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23 && Number.isFinite(minute)) {
      return { hour, minute };
    }
  }

  const singleAmPm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (singleAmPm) {
    let hour = Number(singleAmPm[1]);
    const minute = Number(singleAmPm[2]);
    const period = String(singleAmPm[3]).toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  }

  return null;
}

function mergePreferredSlot(preferredTime, slot) {
  const next = String(slot || '').trim();
  if (next) return [next];
  const times = Array.isArray(preferredTime)
    ? preferredTime.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return times;
}

function toDateKey(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = value instanceof Date ? value : raw ? new Date(raw) : null;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
  return '';
}

function encodeSlotProposal(slot, dateValue, note) {
  const time = String(slot || '').trim();
  const date = toDateKey(dateValue);
  const extra = String(note || '').trim();
  const parts = [time];
  if (date) parts.push(`date:${date}`);
  if (extra) parts.push(extra);
  return `SLOT_PROPOSAL::${parts.join('||')}`;
}

function decodeSlotProposal(feedback) {
  const raw = String(feedback || '').trim();
  const prefix = 'SLOT_PROPOSAL::';
  if (!raw.startsWith(prefix)) {
    return { slot: null, date: null, note: '' };
  }
  const chunks = raw.slice(prefix.length).split('||').map((item) => item.trim()).filter(Boolean);
  let slot = null;
  let date = null;
  const notes = [];
  for (const chunk of chunks) {
    if (chunk.toLowerCase().startsWith('date:')) {
      date = chunk.slice(5).trim().slice(0, 10) || null;
      continue;
    }
    if (!slot && parseSlotStart(chunk)) {
      slot = chunk;
      continue;
    }
    notes.push(chunk);
  }
  return { slot, date, note: notes.join(' ') };
}

function assertFutureBookingDate(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    return { error: 'Please pick a valid date' };
  }
  const year = d.getFullYear();
  const now = new Date();
  if (year < now.getFullYear() || year > now.getFullYear() + 1) {
    return { error: 'Date must be this year or next year. Past years are not allowed.' };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chosen = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (chosen < start) {
    return { error: 'Date must be today or later' };
  }
  return { date: d };
}

/**
 * Build scheduledAt from a calendar date + slot time as Asia/Kolkata wall clock.
 * Avoids UTC server drift (e.g. 14:30 becoming ~20:00 IST in the UI).
 */
function buildScheduledAtFromDateAndSlot(dateValue, slotValue) {
  const slot = parseSlotStart(slotValue);
  const dateKey = toDateKey(dateValue);
  if (!slot || !dateKey) return null;
  const hour = String(slot.hour).padStart(2, '0');
  const minute = String(slot.minute).padStart(2, '0');
  const scheduled = new Date(`${dateKey}T${hour}:${minute}:00+05:30`);
  return Number.isNaN(scheduled.getTime()) ? null : scheduled;
}

module.exports = {
  normalizeRoomId,
  parseSlotStart,
  mergePreferredSlot,
  encodeSlotProposal,
  decodeSlotProposal,
  assertFutureBookingDate,
  buildScheduledAtFromDateAndSlot,
  toDateKey,
};
