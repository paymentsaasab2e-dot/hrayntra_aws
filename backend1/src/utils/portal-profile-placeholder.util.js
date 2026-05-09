/**
 * Portal bootstrap / legacy values that must not be shown as a real first name
 * (e.g. "Good evening, New" from "New Candidate").
 */
function isPortalPlaceholderFullName(name) {
  const t = String(name || '')
    .trim()
    .toLowerCase();
  if (!t) return true;
  return (
    t === 'new candidate' ||
    t === 'user' ||
    t === 'candidate' ||
    t === 'member' ||
    t === 'job seeker'
  );
}

module.exports = { isPortalPlaceholderFullName };
