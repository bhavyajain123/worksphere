import mongoose, { Document, Schema } from "mongoose";

export interface IExpense extends Document {
  budget: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  category: string;
  expenseDate: Date;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    budget: { type: Schema.Types.ObjectId, ref: "Budget", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    description: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    expenseDate: { type: Date, required: true, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

expenseSchema.index({ project: 1, expenseDate: -1 });

export default mongoose.model<IExpense>("Expense", expenseSchema);