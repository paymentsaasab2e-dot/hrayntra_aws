import crypto from 'crypto';

export const generateOtp = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

export const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const compareOtp = (otp, hash) => {
  return hashOtp(otp) === hash;
};
