
import mongoose, { Document, Schema } from "mongoose";

export interface IBudget extends Document {
  project: mongoose.Types.ObjectId;
  allocatedAmount: number;
  currency: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: [0, "Budget cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model<IBudget>("Budget", budgetSchema);
