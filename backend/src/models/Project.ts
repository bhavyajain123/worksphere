
import mongoose, { Schema, type Document } from "mongoose";

export type ProjectStatus =
  | "planning"
  | "active"
  | "on-hold"
  | "completed"
  | "archived";

export interface IProject extends Document {
  name: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  workspace?: mongoose.Types.ObjectId;
  startDate?: Date;
  deadline?: Date;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      index: true,
    },
    startDate: Date,
    deadline: Date,
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "archived"],
      default: "planning",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

projectSchema.index({ members: 1, status: 1 });
projectSchema.index({ workspace: 1, status: 1 });

export default mongoose.model<IProject>("Project", projectSchema);
