import mongoose, { Schema, type Document, type Types } from "mongoose";

export type MilestoneStatus = "upcoming" | "in-progress" | "completed" | "at-risk";

export interface IMilestone extends Document {
  project: Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  status: MilestoneStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IMilestone>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["upcoming", "in-progress", "completed", "at-risk"], default: "upcoming" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model<IMilestone>("Milestone", milestoneSchema);