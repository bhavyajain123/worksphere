
import mongoose, { Document, Schema } from "mongoose";

export type ReportType =
  | "overview"
  | "project"
  | "project-financials"
  | "employee";

export interface IReport extends Document {
  title: string;
  type: ReportType;
  project?: mongoose.Types.ObjectId;
  employee?: mongoose.Types.ObjectId;
  filters: {
    startDate?: Date;
    endDate?: Date;
  };
  data: Record<string, unknown>;
  generatedBy: mongoose.Types.ObjectId;
  generatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "overview",
        "project",
        "project-financials",
        "employee",
      ],
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    filters: {
      startDate: Date,
      endDate: Date,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ generatedBy: 1, generatedAt: -1 });

export default mongoose.model<IReport>("Report", reportSchema);
