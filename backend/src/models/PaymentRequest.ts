import { Schema, model } from "mongoose";

const paymentRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, enum: ["pro"], default: "pro" },
    amount: { type: Number, required: true, min: 1 },
    transactionId: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

export default model("PaymentRequest", paymentRequestSchema);