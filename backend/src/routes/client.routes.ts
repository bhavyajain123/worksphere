import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { listClients, createClient, updateClient, deleteClient } from "../controllers/client.controller";

const router = Router();

router.get("/", authenticateToken, listClients);
router.post("/", authenticateToken, createClient);
router.patch("/:id", authenticateToken, updateClient);
router.delete("/:id", authenticateToken, deleteClient);

export default router;