
import mongoose, { Schema, type Document, type Types } from "mongoose";

export type WorkSphereFileCategory =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "text"
  | "other";

export interface IWorkSphereFile extends Document {
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  extension: string;
  size: number;
  category: WorkSphereFileCategory;
  project: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IWorkSphereFile>(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedName: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
      lowercase: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    category: {
      type: String,
      enum: ["document", "spreadsheet", "presentation", "text", "other"],
      default: "other",
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

fileSchema.index({ project: 1, createdAt: -1 });

const WorkSphereFile = mongoose.model<IWorkSphereFile>(
  "WorkSphereFile",
  fileSchema
);

export default WorkSphereFile;
