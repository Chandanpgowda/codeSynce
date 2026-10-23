import mongoose, { Schema, model, models } from 'mongoose';

export interface IMemberScore {
  user: mongoose.Types.ObjectId;
  /** Scores keyed by criterion key. */
  scores: Record<string, number>;
  /** Human review comments from the evaluator for this member. */
  comments: string;
  total: number;
}

export type EvaluationStatus = 'in_progress' | 'finalized';

export interface IEvaluation {
  project: mongoose.Types.ObjectId;
  evaluator: mongoose.Types.ObjectId;
  criteriaId: mongoose.Types.ObjectId;
  /** Optional criteria snapshot so a finalized evaluation is not altered if the rubric changes. */
  criteriaSnapshot: {
    name: string;
    totalMarks: number;
    criteria: { key: string; label: string; maxMarks: number; description: string }[];
  };
  memberScores: IMemberScore[];
  /** Overall project-level remarks / final comments. */
  overallComments: string;
  status: EvaluationStatus;
  /** When the evaluator finalizes the evaluation. */
  finalizedAt?: Date;
  /** AI-generated draft (advisory only). Never auto-finalizes marks. */
  aiDraft?: {
    suggestedScores: Record<string, number>;
    reasoning: string;
    generatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MemberScoreSchema = new Schema<IMemberScore>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scores: { type: Map, of: Number, default: {} },
  comments: { type: String, default: '' },
  total: { type: Number, default: 0 },
});

const EvaluationSchema = new Schema<IEvaluation>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    criteriaId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationCriteria' },
    criteriaSnapshot: {
      name: { type: String, default: 'Default' },
      totalMarks: { type: Number, default: 100 },
      criteria: [
        {
          key: { type: String },
          label: { type: String },
          maxMarks: { type: Number },
          description: { type: String },
        },
      ],
    },
    memberScores: { type: [MemberScoreSchema], default: [] },
    overallComments: { type: String, default: '' },
    status: { type: String, enum: ['in_progress', 'finalized'], default: 'in_progress' },
    finalizedAt: { type: Date },
    aiDraft: {
      suggestedScores: { type: Map, of: Number, default: {} },
      reasoning: { type: String, default: '' },
      generatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

EvaluationSchema.index({ project: 1, status: 1 });

export default models.Evaluation || model<IEvaluation>('Evaluation', EvaluationSchema);