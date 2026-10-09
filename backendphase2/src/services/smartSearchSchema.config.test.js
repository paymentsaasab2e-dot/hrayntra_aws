import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_STOP_WORDS,
  buildSchemaTextSearchWhere,
} from './smartSearchSchema.config.js';

test('candidate smart-search ignores “relevant CVs” noise', () => {
  assert.equal(SEARCH_STOP_WORDS.has('relevant'), true);
  assert.equal(SEARCH_STOP_WORDS.has('cv'), true);
  assert.equal(SEARCH_STOP_WORDS.has('cvs'), true);
  assert.equal(buildSchemaTextSearchWhere('candidates', 'relevant CVs'), null);
});

test('candidate smart-search matches skills and CV summary text', () => {
  const where = buildSchemaTextSearchWhere('candidates', 'relevant CVs for React in Bengaluru');
  assert.ok(where);
  const clauses = where.AND || [where];
  assert.equal(clauses.length, 2);
  const reactOr = clauses[0].OR;
  assert.ok(reactOr.some((part) => part.cvSummary?.contains === 'React'));
  assert.ok(reactOr.some((part) => Array.isArray(part.skills?.hasSome) && part.skills.hasSome.includes('React')));
  const bengaluruOr = clauses[1].OR;
  assert.ok(bengaluruOr.some((part) => part.city?.contains === 'Bengaluru'));
});
