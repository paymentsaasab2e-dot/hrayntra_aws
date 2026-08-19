const { prisma, retryQuery } = require('../lib/prisma');
const tokenService = require('./token.service');

function clampInterviewPrice(value, fallback = 50) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(5, Math.min(500, n));
}

function bookingSpendService(requestDbId) {
  return `lms.interview.booking.${requestDbId}`;
}

function bookingPayoutService(requestDbId) {
  return `lms.interview.payout.${requestDbId}`;
}

async function hasSpendTransaction(candidateId, requestDbId) {
  const service = bookingSpendService(requestDbId);
  const row = await retryQuery(async () =>
    prisma.tokenTransaction.findFirst({
      where: { candidateId, service, type: 'SPEND' },
      select: { id: true },
    })
  );
  return Boolean(row);
}

async function hasPayoutTransaction(interviewerId, requestDbId) {
  const service = bookingPayoutService(requestDbId);
  const row = await retryQuery(async () =>
    prisma.tokenTransaction.findFirst({
      where: { candidateId: interviewerId, service, type: 'GRANT' },
      select: { id: true },
    })
  );
  return Boolean(row);
}

async function holdInterviewPayment({ candidateId, requestDbId, amount }) {
  const fee = clampInterviewPrice(amount);
  if (await hasSpendTransaction(candidateId, requestDbId)) {
    const bal = await tokenService.getBalance(candidateId);
    return { alreadyHeld: true, spent: 0, tokenBalance: bal.tokenBalance, fee };
  }

  const result = await tokenService.spendTokensAmount(
    candidateId,
    fee,
    bookingSpendService(requestDbId),
    `Interview booking escrow · ${requestDbId} · ${fee} tokens`
  );
  return { alreadyHeld: false, spent: result.spent, tokenBalance: result.tokenBalance, fee };
}

async function releaseInterviewerEarnings({ interviewerId, requestDbId, amount }) {
  const fee = clampInterviewPrice(amount);
  if (!interviewerId || fee <= 0) {
    return { alreadyPaid: true, granted: 0, fee };
  }
  if (await hasPayoutTransaction(interviewerId, requestDbId)) {
    const bal = await tokenService.getBalance(interviewerId);
    return { alreadyPaid: true, granted: 0, tokenBalance: bal.tokenBalance, fee };
  }

  const result = await tokenService.grantTokensAmount(
    interviewerId,
    fee,
    bookingPayoutService(requestDbId),
    `Interview earnings · ${requestDbId} · ${fee} tokens`
  );
  return { alreadyPaid: false, granted: result.granted, tokenBalance: result.tokenBalance, fee };
}

module.exports = {
  clampInterviewPrice,
  bookingSpendService,
  bookingPayoutService,
  hasSpendTransaction,
  holdInterviewPayment,
  releaseInterviewerEarnings,
};
