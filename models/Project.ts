import mongoose, { Schema, model, models } from 'mongoose';

export interface IProjectFile {
  name: string;
  path: string;
  content: string;
  language: string;
  type: 'file';
}

export interface IProjectFolder {
  name: string;
  path: string;
  type: 'folder';
  children: (IProjectFile | IProjectFolder)[];
}

export interface IProject {
  name: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  memberPermissions: Map<string, 'editor' | 'viewer'>;
  pendingRequests: mongoose.Types.ObjectId[];
  language: string;
  tags: string[];
  isPublic: boolean;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  files: (IProjectFile | IProjectFolder)[];
  chatMessages: {
    user: mongoose.Types.ObjectId;
    message: string;
    timestamp: Date;
    replyTo: mongoose.Types.ObjectId;
    codeSnippetLanguage: string;
    codeSnippetCode: string;
    mentions: string[];
    fileReferenceProject: mongoose.Types.ObjectId;
    fileReferencePath: string;
    fileReferenceLine: number;
  }[];
  creatorName?: string;
  /** Project lifecycle: DRAFT → SUBMITTED → UNDER_EVALUATION → EVALUATED */
  status: ProjectStatus;
  /** Evaluator to whom this project is assigned (optional until claimed). */
  assignedEvaluator?: mongoose.Types.ObjectId;
  /** Snapshot captured when the team submits the project for evaluation. */
  submission?: {
    submittedAt: Date;
    submittedBy: mongoose.Types.ObjectId;
    teamSnapshot: { userId: mongoose.Types.ObjectId; name: string }[];
    fileCount: number;
    activitySummary: Record<string, number>;
  };
  lastEditedAt: Date;
  lastEditedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'draft' | 'submitted' | 'under_evaluation' | 'evaluated';

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    memberPermissions: { type: Map, of: String, default: {} },
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    language: { type: String, default: 'javascript' },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    inviteToken: { type: String, select: false },
    inviteExpiresAt: { type: Date, select: false },
    files: { type: Schema.Types.Mixed, default: [] },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_evaluation', 'evaluated'],
      default: 'draft',
      required: true,
    },
    assignedEvaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submission: {
      submittedAt: { type: Date },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      teamSnapshot: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          name: { type: String },
        },
      ],
      fileCount: { type: Number, default: 0 },
      activitySummary: { type: Map, of: Number, default: {} },
    },
    lastEditedAt: { type: Date, default: Date.now },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    chatMessages: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
        replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        codeSnippetLanguage: { type: String },
        codeSnippetCode: { type: String },
        mentions: [{ type: String }],
        fileReferenceProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        fileReferencePath: { type: String },
        fileReferenceLine: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

export default models.Project || model<IProject>('Project', ProjectSchema);
