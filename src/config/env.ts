import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  APP_URL: process.env.APP_URL || 'http://localhost:5000',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_id_verification',

  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_32chars',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production_32chars',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};
