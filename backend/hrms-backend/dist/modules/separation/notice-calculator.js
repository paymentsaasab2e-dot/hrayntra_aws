"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EXIT_CHECKLIST = void 0;
exports.calculateNoticePeriodDays = calculateNoticePeriodDays;
exports.addCalendarDays = addCalendarDays;
exports.calculateShortfall = calculateShortfall;
function calculateNoticePeriodDays(rules, probationEndDate, asOf = new Date()) {
    if (probationEndDate && new Date(probationEndDate) > asOf) {
        return rules.exit.probationNoticeDays;
    }
    return rules.exit.standardNoticeDays;
}
function addCalendarDays(from, days) {
    const result = new Date(from);
    result.setDate(result.getDate() + days);
    result.setHours(0, 0, 0, 0);
    return result;
}
function calculateShortfall(expectedLWD, approvedLWD) {
    const diff = Math.ceil((expectedLWD.getTime() - approvedLWD.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
}
exports.DEFAULT_EXIT_CHECKLIST = [
    { label: 'Manager handover sign-off', done: false },
    { label: 'Asset return', done: false },
    { label: 'Pending leave cleared', done: false },
    { label: 'IT access revocation', done: false },
    { label: 'HR exit interview', done: false },
    { label: 'Experience letter issued', done: false },
];
//# sourceMappingURL=notice-calculator.js.map