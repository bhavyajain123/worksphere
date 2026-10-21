
import mongoose, { Schema, type Document } from "mongoose";

export interface ITeam extends Document {
  name: string;
  description?: string;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  workspace?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ owner: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ workspace: 1 });

export default mongoose.model<ITeam>("Team", teamSchema);
