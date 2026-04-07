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
  return res.status(status).json({
    success: false,
    error: typeof error === 'string' ? error : error.message || 'Internal Server Error'
  });
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
