import { Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Article } from "../models/Article";
import { AuthRequest } from "../middleware/auth";

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(1).max(60),
  content: z.string().trim().min(10).max(10000),
});

const updateSchema = createSchema.partial();

const calcReadingTime = (content: string) =>
  Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 200));

export const createArticle = async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten() });
  }
  const article = await Article.create({
    ...parsed.data,
    readingTime: calcReadingTime(parsed.data.content),
    createdBy: req.user!.id,
  });
  return res.status(201).json({ success: true, article });
};

export const getArticles = async (_req: AuthRequest, res: Response) => {
  const articles = await Article.find().sort({ updatedAt: -1 });
  return res.json({ success: true, articles });
};

export const getArticleById = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid article id" });
  }
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ success: false, message: "Article not found" });
  return res.json({ success: true, article });
};

export const updateArticle = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid article id" });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten() });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.content) data.readingTime = calcReadingTime(parsed.data.content);
  const article = await Article.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!article) return res.status(404).json({ success: false, message: "Article not found" });
  return res.json({ success: true, article });
};

export const deleteArticle = async (req: AuthRequest, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid article id" });
  }
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) return res.status(404).json({ success: false, message: "Article not found" });
  return res.json({ success: true, message: "Article deleted" });
};