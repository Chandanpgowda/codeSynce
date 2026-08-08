import mongoose, { Schema, model, models } from 'mongoose';

export interface IOTP {
  identifier: string; // email or phone number
  code: string;
  type: 'email' | 'phone';
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    identifier: { type: String, required: true },
    code: { type: String, required: true },
    type: { type: String, enum: ['email', 'phone'], required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.OTP || model<IOTP>('OTP', OTPSchema);