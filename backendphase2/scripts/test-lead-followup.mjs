/**
 * Lead page regression checks (pure helpers, no DB).
 * Run: node scripts/test-lead-followup.mjs
 */
import {
  normalizeFollowUpSchedule,
  mergeFollowUpScheduleIntoOtherDetails,
  readFollowUpScheduleFromOtherDetails,
  buildFollowUpEmailDetailsHtml,
  reminderOffsetMs,
  FOLLOW_UP_SCHEDULE_LABEL,
} from '../src/modules/lead/leadFollowUpNotify.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

const futureIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

console.log('\n=== normalizeFollowUpSchedule ===');
const schedule = normalizeFollowUpSchedule(
  {
    type: 'Meet',
    contact: 'client@example.com',
    meetLink: 'meet.google.com/abc-def',
    reminder: '1 hour before',
    timezone: 'Asia/Kolkata',
    attendeeIds: ['507f1f77bcf86cd799439011'],
    notes: 'Discuss pricing',
  },
  futureIso,
);
assert(schedule?.type === 'Meet', 'parses Meet type');
assert(schedule?.meetLink === 'meet.google.com/abc-def', 'parses meet link');
assert(schedule?.reminderAt, 'computes reminderAt for 1 hour before');
assert(schedule?.timezone === 'Asia/Kolkata', 'parses timezone');

console.log('\n=== schedule persistence in otherDetails ===');
const merged = mergeFollowUpScheduleIntoOtherDetails([], schedule);
assert(
  merged.some((r) => r.label === FOLLOW_UP_SCHEDULE_LABEL),
  'stores schedule under __followUpSchedule label',
);
const roundTrip = readFollowUpScheduleFromOtherDetails(merged);
assert(roundTrip?.meetLink === schedule.meetLink, 'round-trips meet link from otherDetails');

const cleared = mergeFollowUpScheduleIntoOtherDetails(merged, null);
assert(
  !cleared.some((r) => r.label === FOLLOW_UP_SCHEDULE_LABEL),
  'clears schedule when merged with null (complete follow-up)',
);

console.log('\n=== buildFollowUpEmailDetailsHtml ===');
const html = buildFollowUpEmailDetailsHtml(schedule, {
  isReminder: false,
  scheduledLabel: 'Wed, 31 Jul 2026, 03:30 pm IST',
  attendees: [{ name: 'Alex Recruiter', email: 'alex@company.com' }],
});
assert(html.includes('meet.google.com/abc-def'), 'email HTML includes meet link');
assert(html.includes('href='), 'meet link is clickable');
assert(html.includes('Asia/Kolkata'), 'email HTML includes timezone');
assert(html.includes('Discuss pricing'), 'email HTML includes notes');
assert(html.includes('Alex Recruiter'), 'email HTML includes attendee name');
assert(html.includes('client@example.com'), 'email HTML includes contact');

const reminderHtml = buildFollowUpEmailDetailsHtml(schedule, {
  isReminder: true,
  scheduledLabel: 'Wed, 31 Jul 2026, 03:30 pm IST',
  attendees: [],
});
assert(reminderHtml.toLowerCase().includes('reminder'), 'reminder email has reminder intro');

console.log('\n=== reminderOffsetMs ===');
assert(reminderOffsetMs('1 hour before') === 60 * 60 * 1000, '1 hour offset');
assert(reminderOffsetMs('No reminder') === null, 'no reminder returns null');

console.log('\n=== Call / Email schedule types ===');
const callSchedule = normalizeFollowUpSchedule(
  { type: 'Call', contact: '+919876543210', reminder: '30 minutes before' },
  futureIso,
);
assert(callSchedule?.type === 'Call', 'Call type schedule normalizes');
assert(callSchedule?.reminderAt, 'Call schedule gets reminderAt');

const emailSchedule = normalizeFollowUpSchedule(
  { type: 'Email', contact: 'lead@example.com', meetLink: 'https://zoom.us/j/123' },
  futureIso,
);
assert(emailSchedule?.type === 'Email', 'Email type schedule normalizes');
assert(emailSchedule?.meetLink === 'https://zoom.us/j/123', 'Email schedule keeps meet link when provided');

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
