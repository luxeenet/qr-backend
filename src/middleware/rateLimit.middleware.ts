import rateLimit from 'express-rate-limit';
import { apiResponse } from '../utils/apiResponse';
import { env } from '../config/env';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: () => env.NODE_ENV === 'test',
  message: undefined,
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Too many login attempts. Please try again after 15 minutes.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Too many password reset requests. Please try again later.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const verificationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  handler: (_req, res) => {
    apiResponse.error(
      res,
      'Too many verification requests. Please slow down.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  handler: (_req, res) => {
    apiResponse.error(res, 'Rate limit exceeded. Please slow down.', 429, 'RATE_LIMIT_EXCEEDED');
  },
  standardHeaders: true,
  legacyHeaders: false,
});
