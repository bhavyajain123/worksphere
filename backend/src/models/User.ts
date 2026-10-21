import mongoose, { Schema, type Document } from "mongoose";
export type UserRole = "admin" | "manager" | "employee";
export interface IUser extends Document {
  name: string;

    email: string;
  password?: string;

  firebaseUid?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    } ,


    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },


    password: {
      type: String,
      required: false,
      select: false,
    },

    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      default: "employee",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model<IUser>("User", userSchema);