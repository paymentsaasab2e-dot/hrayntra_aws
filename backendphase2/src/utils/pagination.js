export const getPaginationParams = (req) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getCursorParams = (req) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const cursor = req.query.cursor || null;
  return { limit, cursor };
};

export const formatPaginationResponse = (data, page, limit, total) => {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};
