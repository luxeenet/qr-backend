import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const apiResponse = {
  success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    pagination?: PaginationMeta
  ) {
    const body: Record<string, unknown> = { success: true, message, data };
    if (pagination) body.pagination = pagination;
    return res.status(statusCode).json(body);
  },

  created<T>(res: Response, data: T, message = 'Created successfully') {
    return res.status(201).json({ success: true, message, data });
  },

  error(
    res: Response,
    message: string,
    statusCode = 500,
    errorCode?: string,
    details?: unknown
  ) {
    const body: Record<string, unknown> = {
      success: false,
      message,
      error: { code: errorCode || 'INTERNAL_ERROR', ...(details ? { details } : {}) },
    };
    return res.status(statusCode).json(body);
  },

  noContent(res: Response) {
    return res.status(204).send();
  },
};
