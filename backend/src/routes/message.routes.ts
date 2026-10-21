
import { Router } from "express";
import {
  sendMessage,
  listMessages,
  markMessageRead,
  deleteMessage,
} from "../controllers/message.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.post("/", sendMessage);
router.get("/:teamId", listMessages);
router.patch("/:id/read", markMessageRead);
router.delete("/:id", deleteMessage);

export default router;
