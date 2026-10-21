import mongoose, { Schema, type Document, type Types } from "mongoose";

export type ClientStatus = "active" | "prospect" | "inactive";

export interface IClient extends Document {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  status: ClientStatus;
  notes: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    contactName: { type: String, trim: true, maxlength: 120, default: "" },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    status: { type: String, enum: ["active", "prospect", "inactive"], default: "active" },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model<IClient>("Client", clientSchema);