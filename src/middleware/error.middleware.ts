import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { Error as MongooseError } from 'mongoose';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${err.errorCode}] ${err.message}`, { stack: err.stack });
    }
    const body: Record<string, unknown> = {
      success: false,
      message: err.message,
      error: { code: err.errorCode },
    };
    if (err instanceof ValidationError && err.details) {
      (body.error as Record<string, unknown>).details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Mongoose validation error
  if (err instanceof MongooseError.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      error: { code: 'VALIDATION_ERROR', details: messages },
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as { code?: number }).code === 11000) {
    const field = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue || {})[0];
    res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists`,
      error: { code: 'CONFLICT' },
    });
    return;
  }

  // JWT errors handled upstream

  // Unknown/unexpected errors
  logger.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    error: {
      code: 'INTERNAL_ERROR',
      ...(env.isDevelopment ? { stack: (err as Error).stack } : {}),
    },
  });
};
