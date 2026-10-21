import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Client from "../models/Client";
import type { AuthRequest } from "../middleware/auth";

const canManage = (req: AuthRequest) => req.user?.role === "admin" || req.user?.role === "manager";
const statusEnum = z.enum(["active", "prospect", "inactive"]);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
  phone: z.string().trim().max(40).optional(),
  status: statusEnum.optional(),
  notes: z.string().trim().max(1000).optional()
});
const updateSchema = createSchema.partial();

const deny = (res: Response) =>
  res.status(403).json({ success: false, message: "Only admin or manager can manage clients" });

export async function listClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) { deny(res); return; }
    const clients = await Client.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: clients.length, clients });
  } catch (error: unknown) {
    console.error("client list failed", error);
    res.status(500).json({ success: false, message: "Unable to fetch clients" });
  }
}

export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) { deny(res); return; }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid client data", errors: parsed.error.flatten() });
      return;
    }
    const client = await Client.create({ ...parsed.data, createdBy: req.user?.id });
    res.status(201).json({ success: true, message: "Client created successfully", client });
  } catch (error: unknown) {
    console.error("client create failed", error);
    res.status(500).json({ success: false, message: "Unable to create client" });
  }
}

export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) { deny(res); return; }
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid client id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid client update", errors: parsed.error.flatten() });
      return;
    }
    const client = await Client.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true });
    if (!client) {
      res.status(404).json({ success: false, message: "Client not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Client updated successfully", client });
  } catch (error: unknown) {
    console.error("client update failed", error);
    res.status(500).json({ success: false, message: "Unable to update client" });
  }
}

export async function deleteClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManage(req)) { deny(res); return; }
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid client id" });
      return;
    }
    const deleted = await Client.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: "Client not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Client deleted successfully" });
  } catch (error: unknown) {
    console.error("client delete failed", error);
    res.status(500).json({ success: false, message: "Unable to delete client" });
  }
}