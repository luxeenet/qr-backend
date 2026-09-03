import { Schema, model, Document, Types } from 'mongoose';

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  logoPath?: string;
  status: OrganizationStatus;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 500 },
    logoPath: { type: String },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      required: true,
      default: OrganizationStatus.ACTIVE,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

organizationSchema.index({ name: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ deletedAt: 1 });

export const Organization = model<IOrganization>('Organization', organizationSchema);
