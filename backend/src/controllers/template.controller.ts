import { Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Template } from "../models/Template";
import { AuthRequest } from "../middleware/auth";

const taskSchema = z.object  ( {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).optional(),
  tasks: z.array(taskSchema).max(50).optional(),
});

const updateSchema = createSchema.partial();

export const createTemplate = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten() });
  }
  const template = await Template.create({ ...parsed.data, createdBy: req.user!.id });
  return res.status(201).json({ success: true, template });
};

export const getTemplates  =   async (_req: AuthRequest, res: Response) => {
  const templates = await Template.find().sort({ createdAt: -1 });
  return res.json({ success: true, templates });
};

export const getTemplateById = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid template id" });
  }
  const template = await Template.findById(req.params.id);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });
  return res.json({ success: true, template });
};
export const updateTemplate = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid template id" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten() });
  }
  const template = await Template.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });
  return res.json({ success: true, template });
};
export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid template id" });
  }
  const template = await Template.findByIdAndDelete(req.params.id);
  if (!template) return res.status(404).json({ success: false, message: "Template not found" });
  return res.json({ success: true, message: "Template deleted" });
};