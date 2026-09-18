/** Soft cap for normal list pages (tables). Export paths may still pass a higher limit explicitly. */
export const LIST_PAGE_MAX_LIMIT = Math.min(
  500,
  Math.max(50, Number(process.env.LIST_PAGE_MAX_LIMIT || 100) || 100),
);

export const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const rawLimit = parseInt(req.query.limit || '10', 10) || 10;
  const limit = Math.min(Math.max(1, rawLimit), LIST_PAGE_MAX_LIMIT);
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
