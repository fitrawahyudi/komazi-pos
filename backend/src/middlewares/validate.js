import { errorResponse } from '../utils/response.js';

export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      const formattedErrors = err.errors?.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || [{ field: 'general', message: err.message }];

      return errorResponse(res, 'Validasi gagal', 400, formattedErrors);
    }
  };
}
                              