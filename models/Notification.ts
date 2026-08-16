import mongoose, { Schema, model, models } from 'mongoose';

export interface INotification {
  user: mongoose.Types.ObjectId;
  type: 'join_request' | 'request_accepted' | 'request_rejected' | 'member_added' | 'member_removed';
  message: string;
  projectId?: mongoose.Types.ObjectId;
  fromUser?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['join_request', 'request_accepted', 'request_rejected', 'member_added', 'member_removed'],
      required: true,
    },
    message: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default models.Notification || model<INotification>('Notification', NotificationSchema);