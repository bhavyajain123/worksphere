
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import employeeRoutes from "./routes/employee.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import leaveRoutes from "./routes/leave.routes";
import notificationRoutes from "./routes/notification.routes";
import activityLogRoutes from "./routes/activityLog.routes";
import timesheetRoutes from "./routes/timesheet.routes";
import teamRoutes from "./routes/team.routes";
import messageRoutes from "./routes/message.routes";
import calendarRoutes from "./routes/calendar.routes";
import goalRoutes from "./routes/goal.routes";
import budgetRoutes from "./routes/budget.routes";
import reportsRoutes from "./routes/reports.routes";
import filesRoutes from "./routes/files.routes";
import workspaceRoutes from "./routes/workspace.routes";
import milestoneRoutes from "./routes/milestone.routes";
import clientRoutes from "./routes/client.routes";
import templateRoutes from "./routes/template.routes";
import articleRoutes from "./routes/article.routes";
import aiRoutes from "./routes/ai.routes";
import billingRoutes from "./routes/billing.routes";

const app = express();

app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS")),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/billing", billingRoutes);


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.name === "MulterError") {
    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;

    return res.status(statusCode).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File size exceeds the 10 MB limit."
          : err.message,
    });
  }

  if (err instanceof Error && err.message.startsWith("Unsupported file type.")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unhandled request error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});



app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WorkSphere backend is running",
    timestamp: new Date().toISOString(),
  });
});

export default app;
