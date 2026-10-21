
import { Router } from "express";
import { getCalendarEvents ,createCalendarEvent,updateCalendarEvent , deleteCalendarEvent} from "../controllers/calendar.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/events", getCalendarEvents);
router.post("/events", createCalendarEvent);
router.patch("/events/:id", updateCalendarEvent);
router.delete("/events/:id", deleteCalendarEvent);

export default router;
