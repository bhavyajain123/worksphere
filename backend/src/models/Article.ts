import mongoose, { Schema, Document, Types } from "mongoose";

export interface IArticle extends Document {
  title: string;
  category: string;
  content: string;
  readingTime: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    content: { type: String, required: true, trim: true, minlength: 10, maxlength: 10000 },
    readingTime: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Article = mongoose.model<IArticle>("Article", articleSchema);