import dbConnect from '@/lib/db';
import Activity from '@/models/Activity';
import type { ActivityType } from '@/models/Activity';
import EvaluationCriteria, { DEFAULT_RUBRIC } from '@/models/EvaluationCriteria';

/**
 * Record a meaningful development event. Call from server-side already after
 * dbConnect() when possible; this helper is safe to call in any order.
 * Returns the created activity (or null if called without a valid project/user).
 */
export async function recordActivity(payload: {
  project: string;
  user: string;
  activityType: ActivityType;
  message: string;
  file?: string;
  task?: string;
  milestone?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await dbConnect();
    const activity = await Activity.create({
      project: payload.project,
      user: payload.user,
      activityType: payload.activityType,
      message: payload.message,
      file: payload.file,
      task: payload.task,
      milestone: payload.milestone,
      metadata: payload.metadata || {},
    });
    return activity;
  } catch (err) {
    console.error('recordActivity error:', err);
    return null;
  }
}

export type RubricDoc = {
  _id?: string;
  name: string;
  description: string;
  totalMarks: number;
  criteria: { key: string; label: string; maxMarks: number; description: string }[];
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Ensure the default evaluation rubric exists in the DB. Returns the default
 * criteria document (seeding it first if needed).
 */
export async function getOrSeedDefaultRubric(): Promise<RubricDoc> {
  await dbConnect();
  const found = (await EvaluationCriteria.findOne({ isDefault: true }).lean()) as RubricDoc | null;
  if (found) return found;
  const doc = new EvaluationCriteria(DEFAULT_RUBRIC);
  await doc.save();
  return doc.toObject() as unknown as RubricDoc;
}