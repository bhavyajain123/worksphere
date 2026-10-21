import mongoose from "mongoose";
import Notification, {
  type NotificationType,
} from "../models/Notification";

interface CreateNotificationInput {
  recipient: string;
  sender?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(
  input: CreateNotificationInput
) {
  if (!mongoose.isValidObjectId(input.recipient)) {
    throw new Error("Invalid notification recipient ID");
  }

  if (input.sender && !mongoose.isValidObjectId(input.sender)) {
    throw new Error("Invalid notification sender ID");
  }

  return Notification.create({
    recipient: new mongoose.Types.ObjectId(input.recipient),
    ...(input.sender
      ? { sender: new mongoose.Types.ObjectId(input.sender) }
      : {}),
    type: input.type,
    title: input.title,
    message: input.message,
    ...(input.link ? { link: input.link } : {}),
  });
}