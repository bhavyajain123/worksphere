import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITemplateTask {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
}

export interface ITemplate extends Document {
  name: string;
  category: string;
  description?: string;
  tasks: ITemplateTask[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const templateTaskSchema = new Schema<ITemplateTask>(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  },
  { _id: false }
);

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 1000 },
    tasks: { type: [templateTaskSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Template = mongoose.model<ITemplate>("Template", templateSchema);