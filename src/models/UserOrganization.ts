import { Schema, model, Document, Types } from 'mongoose';

export interface IUserOrganization extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userOrganizationSchema = new Schema<IUserOrganization>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Enforce unique assignment per user-org pair
userOrganizationSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const UserOrganization = model<IUserOrganization>(
  'UserOrganization',
  userOrganizationSchema
);
