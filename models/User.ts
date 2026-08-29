import mongoose, { Schema, model, models } from 'mongoose';

export type UserRole = 'builder' | 'evaluator';

export interface IUser {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  image?: string;
  googleId?: string;
  provider: 'google' | 'email' | 'phone';
  emailVerified?: boolean;
  phoneVerified?: boolean;
  skills: string[];
  bio?: string;
  /** Server-controlled role. NEVER trusted from client input. */
  role: UserRole;
  /** Controlled evaluator on-boarding: a user must be explicitly granted
      the evaluator role (e.g. via an invite key or by an existing evaluator). */
  projectsOwned: mongoose.Types.ObjectId[];
  projectsJoined: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, select: false },
    image: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    provider: { type: String, enum: ['google', 'email', 'phone'], required: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    skills: [{ type: String }],
    bio: { type: String },
    role: { type: String, enum: ['builder', 'evaluator'], default: 'builder', required: true },
    projectsOwned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    projectsJoined: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  },
  { timestamps: true }
);

export default models.User || model<IUser>('User', UserSchema);