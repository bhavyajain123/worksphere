import mongoose, { Schema, type Document } from "mongoose";
export type TimesheetStatus =  | "draft"   | "submitted"  | "approved"   | "rejected";

export interface ITimesheet extends Document {
  employee: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  workDate: Date;
  hours: number;
  description: string;
  status: TimesheetStatus;
  submittedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timesheetSchema = new Schema<ITimesheet>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    workDate: {
      type: Date,
      required: true,
    },
    hours: {
      type: Number,
      required: true,
      min: 0.25,
      max: 24,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    submittedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);
timesheetSchema.index(
  { employee: 1, project: 1, workDate: 1 },
  { unique: true }
);

timesheetSchema.index({ status: 1, workDate: -1 });

const Timesheet =
  mongoose.models.Timesheet ||
  mongoose.model<ITimesheet>("Timesheet", timesheetSchema);

export default Timesheet;