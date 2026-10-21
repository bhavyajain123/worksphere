import mongoose, { Schema, type Document } from "mongoose";
export type LeaveType =   "casual"| "sick"  | "earned"  | "unpaid";

export type LeaveStatus ="pending" | "approved"   | "rejected"  | "cancelled";

export interface ILeave extends Document {
  employee: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewComment?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leaveSchema = new Schema<ILeave>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    leaveType: {
      type: String,
      enum: ["casual", "sick", "earned", "unpaid"],
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ status: 1, startDate: 1 });

export default mongoose.model<ILeave>("Leave", leaveSchema);