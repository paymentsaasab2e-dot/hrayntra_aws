import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIncludeCommonPoolQuery } from './candidateListQuery.js';

test('common pool stays off unless the caller asks for discover', () => {
  assert.equal(parseIncludeCommonPoolQuery({}), false);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: false }), false);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: 'false' }), false);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: '0' }), false);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: true }), true);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: 'true' }), true);
  assert.equal(parseIncludeCommonPoolQuery({ includeCommonPool: '1' }), true);
});
