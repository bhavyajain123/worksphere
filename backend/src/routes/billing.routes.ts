import { Router } from "express";
import { createPaymentRequest } from "../controllers/billing.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);
router.post("/payments", createPaymentRequest);

export default router;