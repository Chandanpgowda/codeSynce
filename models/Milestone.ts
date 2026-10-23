import mongoose, { Schema, model, models } from 'mongoose';

export interface IMilestone {
  project: mongoose.Types.ObjectId;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  completedAt?: Date;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    dueDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MilestoneSchema.index({ project: 1, order: 1 });

export default models.Milestone || model<IMilestone>('Milestone', MilestoneSchema);