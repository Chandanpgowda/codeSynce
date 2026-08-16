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
  pendingRequests: mongoose.Types.ObjectId[];
  language: string;
  tags: string[];
  isPublic: boolean;
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
  lastEditedAt: Date;
  lastEditedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    language: { type: String, default: 'javascript' },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    files: { type: Schema.Types.Mixed, default: [] },
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