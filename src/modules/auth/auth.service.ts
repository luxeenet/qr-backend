import { User, UserStatus, UserRole } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { AuditLog, AuditAction } from '../../models/AuditLog';
import { verifyPassword, hashPassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../utils/token';
import { UnauthorizedError, NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors';
import { env } from '../../config/env';

export const authService = {
  async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null }).select(
      '+passwordHash'
    );

    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Your account has been deactivated. Contact administrator.');
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    // Update last login
    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({ userId: user._id, token: refreshToken, expiresAt });

    // Audit
    await AuditLog.create({
      userId: user._id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress,
      userAgent,
    });

    const { passwordHash: _, ...userWithoutPassword } = user.toObject();
    return { user: userWithoutPassword, accessToken, refreshToken };
  },

  async refresh(token: string) {
    const stored = await RefreshToken.findOne({ token, revoked: false });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findOne({ _id: payload.userId, status: UserStatus.ACTIVE, deletedAt: null });
    if (!user) throw new UnauthorizedError('User not found');

    // Rotate: revoke old, issue new
    await RefreshToken.updateOne({ _id: stored._id }, { revoked: true });

    const newPayload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({ userId: user._id, token: newRefreshToken, expiresAt });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(userId: string, refreshToken?: string, ipAddress?: string, userAgent?: string) {
    if (refreshToken) {
      await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });
    } else {
      // Revoke all tokens for user
      await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
    }

    await AuditLog.create({
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      userAgent,
    });
  },

  async getMe(userId: string) {
    const user = await User.findOne({ _id: userId, deletedAt: null }).lean();
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await User.findOne({ _id: userId, deletedAt: null }).select('+passwordHash');
    if (!user) throw new NotFoundError('User not found');

    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const newHash = await hashPassword(newPassword);
    await User.updateOne({ _id: userId }, { passwordHash: newHash });

    // Revoke all refresh tokens (force re-login)
    await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });

    await AuditLog.create({
      userId,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      userAgent,
    });
  },

  async updateProfile(
    userId: string,
    data: { name?: string; email?: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) throw new NotFoundError('User not found');

    if (data.email && data.email !== user.email) {
      const conflict = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: userId } });
      if (conflict) throw new ConflictError('A user with this email address already exists');
    }

    const changes: Record<string, unknown> = {};
    if (data.name && data.name !== user.name) {
      user.name = data.name;
      changes.name = data.name;
    }
    if (data.email && data.email !== user.email) {
      user.email = data.email.toLowerCase();
      changes.email = data.email.toLowerCase();
    }

    if (Object.keys(changes).length > 0) {
      await user.save();

      await AuditLog.create({
        userId,
        action: AuditAction.USER_UPDATE,
        entityType: 'User',
        entityId: userId,
        changes,
        ipAddress,
        userAgent,
      });
    }

    return user;
  },
};
