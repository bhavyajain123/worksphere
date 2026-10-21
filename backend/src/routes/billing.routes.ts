import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { authorizeRoles } from "../middleware/authorizeRoles";
import {
  createPaymentRequest,
  listPaymentRequests,
  verifyPaymentRequest,
  rejectPaymentRequest,
} from "../controllers/billing.controller";

const router = Router();

router.use(authenticateToken);

router.post("/payments", createPaymentRequest);
router.get("/payments", authorizeRoles("admin"), listPaymentRequests);
router.post("/payments/:id/verify", authorizeRoles("admin"), verifyPaymentRequest);
router.post("/payments/:id/reject", authorizeRoles("admin"), rejectPaymentRequest);

export default router;