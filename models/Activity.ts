import mongoose, { Schema, model, models } from 'mongoose';

export type ActivityType =
  | 'project_created'
  | 'member_joined'
  | 'member_invited'
  | 'member_removed'
  | 'file_created'
  | 'file_renamed'
  | 'file_deleted'
  | 'file_modified'
  | 'task_created'
  | 'task_updated'
  | 'task_assigned'
  | 'task_completed'
  | 'milestone_created'
  | 'milestone_completed'
  | 'bug_reported'
  | 'bug_resolved'
  | 'code_review'
  | 'test_executed'
  | 'documentation_updated'
  | 'ai_used'
  | 'project_submitted'
  | 'evaluation_started'
  | 'evaluation_finalized'
  | 'chat_message'
  | 'other';

export interface IActivity {
  project: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  activityType: ActivityType;
  /** Short message describing the event (e.g. "Created authentication module"). */
  message: string;
  /** Optional related file path. */
  file?: string;
  /** Optional related task/milestone id. */
  task?: mongoose.Types.ObjectId;
  milestone?: mongoose.Types.ObjectId;
  /** Extra structured metadata (non-sensitive). */
  metadata?: Record<string, any>;
  /** Session info where appropriate (e.g. session start/end) — kept minimal. */
  session?: string | null;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    activityType: { type: String, required: true, index: true },
    message: { type: String, required: true },
    file: { type: String },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    session: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Optimise the two hot query patterns: timeline by project, and per-user contribution.
ActivitySchema.index({ project: 1, createdAt: -1 });
ActivitySchema.index({ project: 1, user: 1, createdAt: -1 });
ActivitySchema.index({ project: 1, activityType: 1 });

export default models.Activity || model<IActivity>('Activity', ActivitySchema);