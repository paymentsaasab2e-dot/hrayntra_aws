const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loginWithPassword } = require('../controllers/auth.controller');
const { prisma } = require('../lib/prisma');

function buildRes() {
  const res = {
    _status: null,
    _body: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
    },
  };
  return res;
}

describe('Portal W1 incomplete-account messaging', () => {
  beforeEach(() => {
    prisma.candidate.findFirst = async () => null;
  });

  it('loginWithPassword returns ACCOUNT_INCOMPLETE for an unverified candidate', async () => {
    prisma.candidate.findFirst = async () => ({
      id: 'c-1',
      email: 'unverified@example.com',
      isVerified: false,
      passwordHash: 'hashed',
      createdAt: new Date(),
    });

    const req = { body: { email: 'unverified@example.com', password: 'password' } };
    const res = buildRes();

    await loginWithPassword(req, res);

    assert.strictEqual(res._status, 403);
    assert.strictEqual(res._body.code, 'ACCOUNT_INCOMPLETE');
    assert.ok(res._body.message.includes('verify your email'));
  });
});
