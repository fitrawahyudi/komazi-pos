/**
 * Standard API Response utilities as specified in PRD Section 8
 */
export function successResponse(res, data = null, message = 'OK', statusCode = 200, meta = null) {
  const payload = {
    success: true,
    message,
    data,
  };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

export function errorResponse(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  const payload = {
    success: false,
    message,
  };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
}
