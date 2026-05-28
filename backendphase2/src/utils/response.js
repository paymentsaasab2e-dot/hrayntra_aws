export const sendResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const sendError = (res, statusCode, message, error = null) => {
  const payload = {
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
  };
  if (error && typeof error === 'object' && error.code) {
    payload.data = { code: error.code, ...(error.meta || {}) };
  }
  res.status(statusCode).json(payload);
};
