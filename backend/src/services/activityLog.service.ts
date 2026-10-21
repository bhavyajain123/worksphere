import mongoose from "mongoose";
import ActivityLog, {
  type ActivityAction,
  type ActivityEntityType,
} from "../models/ActivityLog";

interface CreateActivityLogInput {
  actor: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  description: string;
  details?: Record<string, unknown>;
}

export async function createActivityLog(
  input: CreateActivityLogInput
) {
  if (!mongoose.isValidObjectId(input.actor)) {
    throw new Error("Invalid activity actor ID");
  }

  if (
    input.entityId &&
    !mongoose.isValidObjectId(input.entityId)
  ) {
    throw new Error("Invalid activity entity ID");
  }

  return ActivityLog.create({
    actor: new mongoose.Types.ObjectId(input.actor),
    action: input.action,
    entityType: input.entityType,
    ...(input.entityId
      ? { entityId: new mongoose.Types.ObjectId(input.entityId) }
      : {}),
    description: input.description,
    ...(input.details ? { details: input.details } : {}),
  });
}