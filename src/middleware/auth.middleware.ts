import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/token';
import { User, UserStatus } from '../models/User';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: TokenPayload & { _id: string };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedError('No access token provided');
    }
    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await User.findOne({
      _id: payload.userId,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    }).lean();

    if (!user) {
      throw new UnauthorizedError('User not found or account deactivated');
    }

    req.user = { ...payload, _id: user._id.toString() };
    next();
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      logger.debug('JWT verification failed:', err);
      next(new UnauthorizedError('Invalid or expired access token'));
    }
  }
};
