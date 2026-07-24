/**
 * Shared response helpers for LMS routes
 */

function sendSuccess(res, data, message = undefined) {
  return res.status(200).json({
    success: true,
    data,
    ...(message && { message })
  });
}

function sendCreated(res, data, message = undefined) {
  return res.status(201).json({
    success: true,
    data,
    ...(message && { message })
  });
}

function sendError(res, error, status = 500) {
  console.error('LMS API Error:', error);
  const resolvedStatus = error?.status || status;
  const payload = {
    success: false,
    message: typeof error === 'string' ? error : error.message || 'Internal Server Error',
    error: typeof error === 'string' ? error : error.message || 'Internal Server Error',
  };
  if (error?.code) payload.code = error.code;
  if (error?.balance != null) payload.balance = error.balance;
  if (error?.required != null) payload.required = error.required;
  if (error?.service) payload.service = error.service;
  if (error?.code === 'INSUFFICIENT_TOKENS') {
    payload.shortfall = Math.max(0, (error.required || 0) - (error.balance || 0));
  }
  return res.status(resolvedStatus).json(payload);
}

function sendNotFound(res, error = 'Resource not found') {
  return res.status(404).json({
    success: false,
    error
  });
}

function sendValidationError(res, errors) {
  return res.status(422).json({
    success: false,
    error: 'Validation Error',
    errors
  });
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendValidationError
};
