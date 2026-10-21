import mongoose, { Schema, type Document } from "mongoose";
export type ActivityAction =  | "created" | "updated"  | "deleted" | "assigned"  | "status_changed"  | "approved"  | "rejected"  | "cancelled"   | "archived"    | "login";


export type ActivityEntityType =
  | "user"
  | "project"
  | "task"
  | "leave"
  | "auth"
  | "team"
  | "file"
   | "workspace";
export interface IActivityLog extends Document {
  actor: mongoose.Types.ObjectId;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: mongoose.Types.ObjectId;
  description: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "assigned",
        "status_changed",
        "approved",
        "rejected",
        "cancelled",
        "archived",
        "login",
      ],
      required: true,
    },
entityType: {
  type: String,
  enum: [
    "user",
    "project",
    "task",
    "leave",
    "auth",
    "team",
    "file",
    "workspace",
  ],
  required: true,
},
    entityId: {
      type: Schema.Types.ObjectId,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export default mongoose.model<IActivityLog>(
  "ActivityLog",
  activityLogSchema
);