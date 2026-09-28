const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  enrichPersonalInformationFromResumeText,
  extractPhoneFromResumeText,
  extractEmailFromResumeText,
} = require('./person-name.util.js');

describe('enrichPersonalInformationFromResumeText', () => {
  it('keeps AI phone and city when name is already complete', () => {
    const out = enrichPersonalInformationFromResumeText(
      {
        firstName: 'Rohit',
        lastName: 'Singh',
        fullName: 'Rohit Singh',
        phoneNumber: '9876543210',
        city: 'Pune',
        country: 'India',
        dateOfBirth: '1990-01-15',
      },
      'Rohit Singh\nPune, India',
    );
    assert.equal(out.phoneNumber, '9876543210');
    assert.equal(out.city, 'Pune');
    assert.equal(out.country, 'India');
    assert.equal(out.dateOfBirth, '1990-01-15');
    assert.equal(out.fullName, 'Rohit Singh');
  });

  it('fills missing phone and email from resume text', () => {
    const text = 'Rohit Singh\nPhone: +91 98765 43210\nEmail: rohit@example.com\nDOB: 15/01/1990\nAddress: Pune, India';
    const out = enrichPersonalInformationFromResumeText(
      { firstName: 'Rohit', lastName: 'Singh', fullName: 'Rohit Singh' },
      text,
    );
    assert.equal(out.email, 'rohit@example.com');
    assert.match(String(out.phoneNumber), /98765/);
    assert.equal(out.dateOfBirth, '15/01/1990');
    assert.equal(out.city, 'Pune');
    assert.equal(out.country, 'India');
  });

  it('extracts a labeled mobile number', () => {
    assert.match(String(extractPhoneFromResumeText('Mobile: +237 670 00 00 00')), /670/);
    assert.equal(extractEmailFromResumeText('Contact rohit.test@poyeso.com today'), 'rohit.test@poyeso.com');
  });
});
