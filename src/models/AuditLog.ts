import { Schema, model, Document, Types } from 'mongoose';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE_ORGANIZATION = 'CREATE_ORGANIZATION',
  UPDATE_ORGANIZATION = 'UPDATE_ORGANIZATION',
  DELETE_ORGANIZATION = 'DELETE_ORGANIZATION',
  CREATE_UPLOADER = 'CREATE_UPLOADER',
  UPDATE_UPLOADER = 'UPDATE_UPLOADER',
  DELETE_UPLOADER = 'DELETE_UPLOADER',
  ASSIGN_ORGANIZATION = 'ASSIGN_ORGANIZATION',
  REMOVE_ORGANIZATION_ASSIGNMENT = 'REMOVE_ORGANIZATION_ASSIGNMENT',
  CREATE_ID = 'CREATE_ID',
  UPDATE_ID = 'UPDATE_ID',
  DELETE_ID = 'DELETE_ID',
  CHANGE_ID_STATUS = 'CHANGE_ID_STATUS',
  GENERATE_QR = 'GENERATE_QR',
  REGENERATE_QR = 'REGENERATE_QR',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  USER_UPDATE = 'USER_UPDATE',
  UPLOAD_IMAGE = 'UPLOAD_IMAGE',
  UPLOAD_LOGO = 'UPLOAD_LOGO',
}

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId?: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ organizationId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
