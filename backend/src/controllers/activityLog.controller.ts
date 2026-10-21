
import type { Response } from "express";
import { z } from "zod";
import ActivityLog from "../models/ActivityLog";
import type { AuthRequest } from "../middleware/auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.enum(["user", "project", "task", "leave", "auth"]).optional(),
  action: z.enum([
    "created",
    "updated",
    "deleted",
    "assigned",
    "status_changed",
    "approved",
    "rejected",
    "cancelled",
    "archived",
    "login",
  ]).optional(),
});

export async function listActivityLogs(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid activity log filters",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { page, limit, entityType, action } = parsed.data;

  const filter: Record<string, unknown> = {};

  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  res.status(200).json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}


export async function getActivityLogById(
  req: AuthRequest,
  res: Response
): Promise<void> {
 
const id = req.params.id;

if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
  res.status(400).json({ message: "Invalid activity log ID" });
  return;
}


  const log = await ActivityLog.findById(id)
    .populate("actor", "name email role")
    .lean();

  if (!log) {
    res.status(404).json({ message: "Activity log not found" });
    return;
  }

  res.status(200).json({ log });
}
