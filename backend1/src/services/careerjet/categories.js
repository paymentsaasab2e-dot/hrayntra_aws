/**
 * Careerjet official XML does not define a category field.
 * https://www.careerjet.com/docs/feeds/xml
 * Keep a text helper for review notes only — do not emit Adzuna numeric IDs.
 */

function careerjetCategoryText(job) {
  const value = String(job?.jobCategory || job?.industry || job?.department || '').trim();
  return value || null;
}

module.exports = {
  careerjetCategoryText,
};
