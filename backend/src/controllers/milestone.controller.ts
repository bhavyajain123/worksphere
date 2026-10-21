import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Milestone from "../models/Milestone";
import type { AuthRequest } from "../middleware/auth";

const canManage = (req: AuthRequest) => req.user?.role === "admin" || req.user?.role === "manager";
const statusEnum = z.enum(["upcoming", "in-progress", "completed", "at-risk"]);

const createSchema = z.object({
  project: z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid project id"),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.coerce.date(),
  status: statusEnum.optional()
});

const updateSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.coerce.date().optional(),
  status: statusEnum.optional()
});

export async function listMilestones(req: AuthRequest, res: Response): Promise<void> {
  try {
    const filter: Record<string, unknown> = {};
    const projectId = req.query.projectId;
    if (typeof projectId === "string" && mongoose.isValidObjectId(projectId)) filter.project = projectId;

    const milestones = await Milestone.find(filter)
      .populate("project", "name status")
      .populate("createdBy", "name")
      .sort({ dueDate: 1 });

    res.status(200).json({ success: true, count: milestones.length, milestones });
  } catch (error: unknown) {
    console.error("milestone list failed", error);
    res.status(500).json({ success: false, message: "Unable to fetch milestones" });
  }
}

export async function createMilestone(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) {
      res.status(403).json({ success: false, message: "Only admin or manager can create milestones" });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid milestone data", errors: parsed.error.flatten() });
      return;
    }
    const milestone = await Milestone.create({ ...parsed.data, createdBy: req.user?.id });
    await milestone.populate("project", "name status");
    res.status(201).json({ success: true, message: "Milestone created successfully", milestone });
  } catch (error: unknown) {
    console.error("milestone create failed", error);
    res.status(500).json({ success: false, message: "Unable to create milestone" });
  }
}

export async function updateMilestone(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) {
      res.status(403).json({ success: false, message: "Only admin or manager can update milestones" });
      return;
    }
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid milestone id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid milestone update", errors: parsed.error.flatten() });
      return;
    }
    const milestone = await Milestone.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true })
      .populate("project", "name status");
    if (!milestone) {
      res.status(404).json({ success: false, message: "Milestone not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Milestone updated successfully", milestone });
  } catch (error: unknown) {
    console.error("milestone update failed", error);
    res.status(500).json({ success: false, message: "Unable to update milestone" });
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) {
      res.status(403).json({ success: false, message: "Only admin or manager can delete milestones" });
      return;
    }
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid milestone id" });
      return;
    }
    const deleted = await Milestone.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Milestone not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Milestone deleted successfully" });
  } catch (error: unknown) {
    console.error("milestone delete failed", error);
    res.status(500).json({ success: false, message: "Unable to delete milestone" });
  }
}