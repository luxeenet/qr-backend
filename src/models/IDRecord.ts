import { Schema, model, Document, Types } from 'mongoose';

export enum IDStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export interface IIDRecord extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  idNumber: string;
  imagePath?: string;
  verificationToken: string;
  status: IDStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const idRecordSchema = new Schema<IIDRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    idNumber: { type: String, required: true, trim: true, maxlength: 100 },
    imagePath: { type: String },
    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(IDStatus),
      required: true,
      default: IDStatus.ACTIVE,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique ID number per organization
idRecordSchema.index({ organizationId: 1, idNumber: 1 }, { unique: true });
idRecordSchema.index({ deletedAt: 1 });
idRecordSchema.index({ createdAt: -1 });

export const IDRecord = model<IIDRecord>('IDRecord', idRecordSchema);
