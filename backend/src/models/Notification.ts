import mongoose, { Schema, type Document } from "mongoose";
export type NotificationType =  | "task_assigned" | "task_updated"  | "leave_approved"   | "leave_rejected"  | "leave_cancelled" | "project_updated"  | "timesheet_submitted" | "timesheet_approved"| "timesheet_rejected"| "system";

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_updated",
        "leave_approved",
        "leave_rejected",
        "leave_cancelled",
        "project_updated",
        "timesheet_submitted",
"timesheet_approved",
"timesheet_rejected",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model<INotification>(
  "Notification",
  notificationSchema
);