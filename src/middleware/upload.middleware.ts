import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), env.UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeFilename = `${uuidv4()}${ext}`;
    cb(null, safeFilename);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new ValidationError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
    );
  }
  cb(null, true);
};

export const uploadSingle = (fieldName: string) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: env.MAX_FILE_SIZE },
  }).single(fieldName);

export const handleUploadError = (err: unknown, fieldName: string) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      throw new ValidationError(
        `File too large. Maximum size is ${env.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }
    throw new ValidationError(`Upload error: ${err.message}`);
  }
  throw err;
};
