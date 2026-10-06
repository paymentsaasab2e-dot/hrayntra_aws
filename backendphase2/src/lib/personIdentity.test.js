import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  newPersonId,
  normalizeEmail,
  normalizePhoneE164,
  resumeSha256FromBuffer,
  fingerprintKeys,
  buildIdentityFields,
} from './personIdentity.js';

describe('personIdentity', () => {
  it('newPersonId returns a UUID string', () => {
    const id = newPersonId();
    assert.equal(typeof id, 'string');
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('normalizeEmail lowercases, trims and removes whitespace', () => {
    assert.equal(normalizeEmail('  John.Doe@Example.COM '), 'john.doe@example.com');
    assert.equal(normalizeEmail('Jane\tDoe@Example.com'), 'janedoe@example.com');
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
  });

  it('normalizePhoneE164 keeps leading + and strips non-digits', () => {
    assert.equal(normalizePhoneE164('+91 98765 43210'), '+919876543210');
    assert.equal(normalizePhoneE164('(555) 123-4567'), '5551234567');
    assert.equal(normalizePhoneE164('+44-20-7946-0958'), '+442079460958');
    assert.equal(normalizePhoneE164(''), '');
    assert.equal(normalizePhoneE164(null), '');
  });

  it('resumeSha256FromBuffer returns a 64-char hex hash', () => {
    const hash = resumeSha256FromBuffer(Buffer.from('resume content'));
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('fingerprintKeys builds deterministic keys from normalized values', () => {
    const keys = fingerprintKeys({
      emailNormalized: 'john@example.com',
      phoneE164: '+919876543210',
      resumeSha256: 'abc123',
    });
    assert.deepEqual(keys, ['email|john@example.com', 'phone|+919876543210', 'resume|abc123']);
  });

  it('fingerprintKeys skips empty values', () => {
    const keys = fingerprintKeys({ emailNormalized: 'jane@example.com', phoneE164: '', resumeSha256: '' });
    assert.deepEqual(keys, ['email|jane@example.com']);
  });

  it('buildIdentityFields reuses existing personId', () => {
    const existing = 'existing-person-id';
    const result = buildIdentityFields({
      email: 'John@Example.COM',
      phone: '+91 98765 43210',
      existingPersonId: existing,
      resumeSha256: 'hash123',
    });
    assert.equal(result.personId, existing);
    assert.equal(result.emailNormalized, 'john@example.com');
    assert.equal(result.phoneE164, '+919876543210');
    assert.deepEqual(result.fingerprintKeys, [
      'email|john@example.com',
      'phone|+919876543210',
      'resume|hash123',
    ]);
  });

  it('buildIdentityFields mints personId when missing', () => {
    const result = buildIdentityFields({
      email: 'jane@example.com',
      phone: '5551234567',
    });
    assert.ok(result.personId);
    assert.match(result.personId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(result.emailNormalized, 'jane@example.com');
    assert.equal(result.phoneE164, '5551234567');
  });

  it('buildIdentityFields skips empty email and phone in fingerprint keys', () => {
    const result = buildIdentityFields({ email: '', phone: null, resumeSha256: 'hash' });
    assert.deepEqual(result.fingerprintKeys, ['resume|hash']);
    assert.equal(result.emailNormalized, '');
    assert.equal(result.phoneE164, '');
  });
});
