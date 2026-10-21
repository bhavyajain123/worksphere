import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";
import PaymentRequest from "../models/PaymentRequest";

const createSchema = z.object({
  plan: z.literal("pro"),
  amount: z.number().positive(),
  transactionId: z.string().trim().regex(/^[A-Za-z0-9]{12,30}$/),
});

export async function createPaymentRequest(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid transaction ID or amount" });
    return;
  }

  try {
    const request = await PaymentRequest.create({
      user: req.user!.id,
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