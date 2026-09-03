import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema, changePasswordSchema, updateProfileSchema, validate } from './auth.validation';
import { apiResponse } from '../../utils/apiResponse';
import { AuthRequest } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const body = validate(loginSchema, req.body);
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(body.email, body.password, ipAddress, userAgent);

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return apiResponse.success(
        res,
        { user: result.user, accessToken: result.accessToken },
        'Login successful'
      );
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        return apiResponse.error(res, 'Refresh token not provided', 401, 'UNAUTHORIZED');
      }
      const result = await authService.refresh(token);
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
      return apiResponse.success(res, { accessToken: result.accessToken }, 'Token refreshed');
    } catch (err) {
      next(err);
    }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      await authService.logout(req.user!._id, refreshToken, req.ip, req.headers['user-agent']);
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return apiResponse.success(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!._id);
      return apiResponse.success(res, { user }, 'User profile retrieved');
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = validate(changePasswordSchema, req.body);
      await authService.changePassword(
        req.user!._id,
        body.currentPassword,
        body.newPassword,
        req.ip,
        req.headers['user-agent']
      );
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return apiResponse.success(res, null, 'Password changed successfully. Please log in again.');
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = validate(updateProfileSchema, req.body);
      const user = await authService.updateProfile(
        req.user!._id,
        body,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { user }, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  },
};
