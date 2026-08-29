import mongoose, { Schema, model, models } from 'mongoose';

export interface ICriterion {
  key: string;
  label: string;
  maxMarks: number;
  description: string;
}

export interface IEvaluationCriteria {
  /** Human-readable name of this rubric (e.g. "Default", "Institution A"). */
  name: string;
  description: string;
  criteria: ICriterion[];
  /** Sum of criteria maxMarks should equal totalMarks (validated). */
  totalMarks: number;
  isDefault: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationCriteriaSchema = new Schema<IEvaluationCriteria>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    criteria: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        maxMarks: { type: Number, required: true },
        description: { type: String, default: '' },
      },
    ],
    totalMarks: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const DEFAULT_RUBRIC: IEvaluationCriteria = {
  name: 'Default',
  description: 'Default CodeSynce evaluation rubric',
  totalMarks: 100,
  isDefault: true,
  criteria: [
    { key: 'problem_understanding', label: 'Problem Understanding', maxMarks: 10, description: 'Understanding and definition of the problem.' },
    { key: 'technical_implementation', label: 'Technical Implementation', maxMarks: 20, description: 'Working implementation of core features.' },
    { key: 'individual_contribution', label: 'Individual Contribution', maxMarks: 20, description: 'Contribution to the project based on evidence.' },
    { key: 'innovation', label: 'Innovation', maxMarks: 15, description: 'Creativity and novel use of techniques.' },
    { key: 'code_quality', label: 'Code Quality', maxMarks: 10, description: 'Readability, structure, maintainability.' },
    { key: 'testing', label: 'Testing', maxMarks: 10, description: 'Testing activity and test coverage.' },
    { key: 'documentation', label: 'Documentation', maxMarks: 5, description: 'Quality of documentation and comments.' },
    { key: 'presentation', label: 'Presentation', maxMarks: 10, description: 'Presentation, demo, and clarity.' },
  ] as ICriterion[],
} as IEvaluationCriteria;

export default models.EvaluationCriteria ||
  model<IEvaluationCriteria>('EvaluationCriteria', EvaluationCriteriaSchema);