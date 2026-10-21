
import mongoose, { Schema, type Document } from "mongoose";

export type CalendarEventType = "meeting" | "team-event";

export interface ICalendarEvent extends Document {
  title: string;
  description: string;
  type: CalendarEventType;
  startDate: Date;
  endDate: Date;
  location?: string;
  createdBy: mongoose.Types.ObjectId;
  attendees: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000
    },
    type: {
      type: String,
      enum: ["meeting", "team-event"],
      required: true,
      default: "meeting"
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true
    },
    location: {
      type: String,
      trim: true,
      maxlength: 250
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    attendees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

calendarEventSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model<ICalendarEvent>(
  "CalendarEvent",
  calendarEventSchema
);
