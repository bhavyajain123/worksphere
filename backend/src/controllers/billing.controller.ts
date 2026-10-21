import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import PaymentRequest from "../models/PaymentRequest";
import Workspace from "../models/Workspace";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const createSchema = z.object({
  plan: z.string().trim().toLowerCase().pipe(z.literal("pro")),
  amount: z.coerce.number().positive(),
  transactionId: z.string().trim().regex(/^[A-Za-z0-9]{12,30}$/),
  workspaceId: objectId,
});
export async function createPaymentRequest(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  console.error("Payment validation failed:", errors, req.body);
  res.status(400).json({
    success: false,
    message: `Invalid fields: ${Object.keys(errors).join(", ")}`,
    errors,
  });
  return;
}

  try {
    const workspace = await Workspace.findById(parsed.data.workspaceId);
    const userId = req.user!.id;
    const allowed =
      workspace &&
      (String(workspace.owner) === userId ||
        workspace.members.some((m) => String(m) === userId));
    if (!workspace || !allowed) {
      res.status(403).json({ success: false, message: "You do not have access to this workspace" });
      return;
    }

    const request = await PaymentRequest.create({
      user: userId,
      workspace: workspace._id,
      plan: parsed.data.plan,
      amount: parsed.data.amount,
      transactionId: parsed.data.transactionId.toUpperCase(),
    });
    res.status(201).json({ success: true, data: request });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      res.status(409).json({ success: false, message: "This transaction ID has already been submitted" });
      return;
    }
    console.error("Create payment request failed:", error);
    res.status(500).json({ success: false, message: "Unable to submit payment request" });
  }
}


export async function listPaymentRequests(req: AuthRequest, res: Response): Promise<void> {
  const status = String(req.query.status ?? "pending");
   const filter: Record<string, string> = ["pending", "verified", "rejected"].includes(status)
    ? { status }
    : {};
  try {
    const items = await PaymentRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("user", "name email")
      .populate("workspace", "name plan");
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("List payment requests failed:", error);
    res.status(500).json({ success: false, message: "Unable to load payment requests" });
  }
}

async function review(req: AuthRequest, res: Response, next: "verified" | "rejected"): Promise<void> {
  const id = String(req.params.id);
  if (!objectId.safeParse(id).success) {
    res.status(400).json({ success: false, message: "Invalid request id" });
    return;
  }

  try {
    const existing = await PaymentRequest.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: "Payment request not found" });
      return;
    }
    if (next === "verified" && !existing.workspace) {
      res.status(400).json({
        success: false,
        message: "This older request has no workspace linked. Please reject it.",
      });
      return;
    }


    const updated = await PaymentRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: next, reviewedBy: req.user!.id, reviewedAt: new Date() },
      { new: true }
    );
    if (!updated) {
      res.status(409).json({ success: false, message: "This request was already reviewed" });
      return;
    }

    if (next === "verified" && updated.workspace) {
      await Workspace.findByIdAndUpdate(updated.workspace, { plan: "pro" });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Review payment request failed:", error);
    res.status(500).json({ success: false, message: "Unable to update payment request" });
  }
}

export const verifyPaymentRequest = (req: AuthRequest, res: Response) => review(req, res, "verified");
export const rejectPaymentRequest = (req: AuthRequest, res: Response) => review(req, res, "rejected");