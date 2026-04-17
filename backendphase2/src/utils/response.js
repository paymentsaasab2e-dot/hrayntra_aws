export const sendResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const sendError = (res, statusCode, message, error = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
  });
};
