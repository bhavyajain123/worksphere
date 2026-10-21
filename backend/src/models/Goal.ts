import mongoose, { Document, Schema } from "mongoose";

export interface IGoal extends Document {
  title: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];
  startDate: Date;
  dueDate: Date;
  status: "not-started" | "in-progress" | "completed" | "cancelled";
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    title: {
      type: String,
      required: [true, "Goal title is required"],
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "completed", "cancelled"],
      default: "not-started",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

goalSchema.index({ owner: 1, dueDate: 1 });
goalSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model<IGoal>("Goal", goalSchema);