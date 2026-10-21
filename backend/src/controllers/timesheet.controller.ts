
import { Request, Response } from "express";
import mongoose from "mongoose";
import Timesheet from "../models/Timesheet";
import Project from "../models/Project";
import { createActivityLog } from "../services/activityLog.service";

import User from "../models/User";
import Notification from "../models/Notification";

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

const isValidObjectId = (id: string) =>
  mongoose.Types.ObjectId.isValid(id);

const canReview = (role: string) =>
  ["admin", "manager"].includes(role.toLowerCase());


export const createTimesheet = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const employeeId = req.user?.id;
    const { project: projectId, workDate, hours, description } = req.body;

    if (!employeeId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (
      !projectId ||
      !isValidObjectId(projectId) ||
      !workDate ||
      hours === undefined ||
      !description?.trim()
    ) {
      return res.status(400).json({
        message: "Valid project, workDate, hours and description are required",
      });
    }

    const numericHours = Number(hours);
    const parsedDate = new Date(workDate);

    if (
      !Number.isFinite(numericHours) ||
      numericHours < 0.25 ||
      numericHours > 24
    ) {
      return res.status(400).json({
        message: "Hours must be between 0.25 and 24",
      });
    }

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid workDate" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (String(project.status).toLowerCase() === "archived") {
      return res.status(400).json({
        message: "Cannot log hours against an archived project",
      });
    }

    const timesheet = await Timesheet.create({
      employee: employeeId,
      project: projectId,
      workDate: parsedDate,
      hours: numericHours,
      description: description.trim(),
    });

    await createActivityLog({
      actor: employeeId,
      action: "created",
      entityType: "task",
      entityId: String(timesheet._id),
      description: "Timesheet entry created",
      details: { project: projectId, hours: numericHours },
    });

    return res.status(201).json({
      message: "Timesheet entry created successfully",
      timesheet,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "A timesheet already exists for this project and date",
      });
    }

    console.error("Create timesheet error:", error);
    return res.status(500).json({ message: "Failed to create timesheet" });
  }
};

export const getMyTimesheets = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const employeeId = req.user?.id;

    if (!employeeId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { status, from, to, page = "1", limit = "10" } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const filter: Record<string, any> = { employee: employeeId };

    if (status) {
      const allowedStatuses = ["draft", "submitted", "approved", "rejected"];

      if (!allowedStatuses.includes(String(status))) {
        return res.status(400).json({ message: "Invalid status filter" });
      }

      filter.status = status;
    }

    if (from || to) {
      filter.workDate = {};

      if (from) {
        const start = new Date(String(from));
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid from date" });
        }
        filter.workDate.$gte = start;
      }

      if (to) {
        const end = new Date(String(to));
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid to date" });
        }
        end.setHours(23, 59, 59, 999);
        filter.workDate.$lte = end;
      }
    }

    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate("project", "name status")
        .populate("reviewedBy", "name email")
        .sort({ workDate: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Timesheet.countDocuments(filter),
    ]);

    return res.json({
      timesheets,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get my timesheets error:", error);
    return res.status(500).json({ message: "Failed to fetch timesheets" });
  }
};


export const getAllTimesheets = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || !canReview(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { status, employee, project, from, to, page = "1", limit = "10" } =
      req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const filter: Record<string, any> = {};

    if (status) {
      const allowedStatuses = ["draft", "submitted", "approved", "rejected"];

      if (!allowedStatuses.includes(String(status))) {
        return res.status(400).json({ message: "Invalid status filter" });
      }

      filter.status = status;
    }

    for (const [key, value] of [
      ["employee", employee],
      ["project", project],
    ] as const) {
      if (value) {
        if (!isValidObjectId(String(value))) {
          return res.status(400).json({ message: `Invalid ${key} ID` });
        }
        filter[key] = value;
      }
    }

    if (from || to) {
      filter.workDate = {};

      if (from) {
        const start = new Date(String(from));
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid from date" });
        }
        filter.workDate.$gte = start;
      }

      if (to) {
        const end = new Date(String(to));
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid to date" });
        }
        end.setHours(23, 59, 59, 999);
        filter.workDate.$lte = end;
      }
    }

    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate("employee", "name email role")
        .populate("project", "name status")
        .populate("reviewedBy", "name email")
        .sort({ workDate: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Timesheet.countDocuments(filter),
    ]);

    return res.json({
      timesheets,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get all timesheets error:", error);
    return res.status(500).json({ message: "Failed to fetch timesheets" });
  }
};


export const updateTimesheet = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const employeeId = req.user?.id;
    const id = req.params.id;

    if (!employeeId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (typeof id !== "string" || !isValidObjectId(id)) {
  return res.status(400).json({ message: "Invalid timesheet ID" });
}

    const timesheet = await Timesheet.findById(id);

    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet not found" });
    }

    if (String(timesheet.employee) !== employeeId) {
      return res.status(403).json({ message: "You can only update your own timesheets" });
    }

    if (!["draft", "rejected"].includes(timesheet.status)) {
      return res.status(400).json({
        message: "Only draft or rejected timesheets can be updated",
      });
    }

    const { project: projectId, workDate, hours, description } = req.body;

    if (projectId !== undefined) {
      if (!isValidObjectId(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await Project.findById(projectId);

      if (!project || String(project.status).toLowerCase() === "archived") {
        return res.status(400).json({
          message: "Project not found or archived",
        });
      }

      timesheet.project = project._id as mongoose.Types.ObjectId;
    }

    if (workDate !== undefined) {
      const parsedDate = new Date(workDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid workDate" });
      }

      timesheet.workDate = parsedDate;
    }

    if (hours !== undefined) {
      const numericHours = Number(hours);

      if (
        !Number.isFinite(numericHours) ||
        numericHours < 0.25 ||
        numericHours > 24
      ) {
        return res.status(400).json({
          message: "Hours must be between 0.25 and 24",
        });
      }

      timesheet.hours = numericHours;
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "Description cannot be empty" });
      }

      timesheet.description = description.trim();
    }

    timesheet.status = "draft";
    timesheet.submittedAt = undefined;
    timesheet.reviewedBy = undefined;
    timesheet.reviewedAt = undefined;
    timesheet.reviewComment = undefined;

await timesheet.save();

try {
  const [employee, admins] = await Promise.all([
    User.findById(employeeId).select("name"),
    User.find({ role: "admin", isActive: true }).select("_id"),
  ]);

  console.log("Timesheet notification debug:", {
    employeeFound: Boolean(employee),
    adminsFound: admins.length,
  });

  if (admins.length > 0) {
    await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        sender: employeeId,
        type: "timesheet_submitted" as const,
        title: "Timesheet submitted",
        message: `${employee?.name || "An employee"} submitted ${timesheet.hours} hours for review.`,
        link: "/timesheets",
      }))
    );

    console.log("Timesheet submission notifications created");
  } else {
    console.warn("No active admin found for timesheet notification");
  }
} catch (notificationError) {
  console.error(
    "Timesheet submission notification failed:",
    notificationError
  );
}


return res.json({
  message: "Timesheet submitted for review",
  timesheet,
});
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "A timesheet already exists for this project and date",
      });
    }

    console.error("Update timesheet error:", error);
    return res.status(500).json({ message: "Failed to update timesheet" });
  }
};


export const submitTimesheet = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const employeeId = req.user?.id;
   const id = req.params.id;

    if (!employeeId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (typeof id !== "string" || !isValidObjectId(id)) {
  return res.status(400).json({ message: "Invalid timesheet ID" });
}

    const timesheet = await Timesheet.findOne({
      _id: id,
      employee: employeeId,
    });

    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet not found" });
    }

    if (!["draft", "rejected"].includes(timesheet.status)) {
      return res.status(400).json({
        message: "Only draft or rejected timesheets can be submitted",
      });
    }

    timesheet.status = "submitted";
    timesheet.submittedAt = new Date();
    timesheet.reviewedBy = undefined;
    timesheet.reviewedAt = undefined;
    timesheet.reviewComment = undefined;

   
await timesheet.save();

console.log("SUBMIT TIMESHEET FUNCTION HIT");

try {
  const [employee, admins] = await Promise.all([
    User.findById(employeeId).select("name"),
    User.find({ role: "admin", isActive: true }).select("_id"),
  ]);

  console.log("Timesheet notification debug:", {
    employeeFound: Boolean(employee),
    adminsFound: admins.length,
  });

  if (admins.length > 0) {
    await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        sender: employeeId,
        type: "timesheet_submitted" as const,
        title: "Timesheet submitted",
        message: `${employee?.name || "An employee"} submitted ${timesheet.hours} hours for review.`,
        link: "/timesheets",
      }))
    );

    console.log("Timesheet submission notifications created");
  } else {
    console.warn("No active admin found for timesheet notification");
  }
} catch (notificationError) {
  console.error(
    "Timesheet submission notification failed:",
    notificationError
  );
}

console.log("ABOUT TO RETURN SUBMIT RESPONSE");

    return res.json({
      message: "Timesheet submitted for review",
      timesheet,
    });
  } catch (error) {
    console.error("Submit timesheet error:", error);
    return res.status(500).json({ message: "Failed to submit timesheet" });
  }
};


export const reviewTimesheet = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const reviewerId = req.user?.id;
    const reviewerRole = req.user?.role;
    const id = req.params.id;
    const { status, reviewComment } = req.body;

    if (!reviewerId || !reviewerRole || !canReview(reviewerRole)) {
      return res.status(403).json({ message: "Not authorized to review timesheets" });
    }

    if (typeof id !== "string" || !isValidObjectId(id)) {
  return res.status(400).json({ message: "Invalid timesheet ID" });
}

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be approved or rejected",
      });
    }

    if (
      reviewComment !== undefined &&
      (typeof reviewComment !== "string" || reviewComment.length > 1000)
    ) {
      return res.status(400).json({ message: "Invalid reviewComment" });
    }

    const timesheet = await Timesheet.findById(id);

    if (!timesheet) {
      return res.status(404).json({ message: "Timesheet not found" });
    }

    if (reviewerRole.toLowerCase() === "manager") {
  const project = await Project.findById(timesheet.project)
    .select("owner members");

  if (!project) {
    return res.status(404).json({
      message: "Timesheet project not found",
    });
  }

  const managerId = String(reviewerId);

  const isProjectOwner = String(project.owner) === managerId;

  const isProjectMember = project.members.some(
    (member) => String(member) === managerId
  );

  if (!isProjectOwner && !isProjectMember) {
    return res.status(403).json({
      message: "You can review timesheets only for your assigned projects",
    });
  }
}

    if (timesheet.status !== "submitted") {
      return res.status(400).json({
        message: "Only submitted timesheets can be reviewed",
      });
    }

    timesheet.status = status;
    timesheet.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
    timesheet.reviewedAt = new Date();
    timesheet.reviewComment = reviewComment?.trim() || undefined;

    await timesheet.save();

    try {
  const reviewer = await User.findById(reviewerId).select("name");

  await Notification.create({
    recipient: timesheet.employee,
    sender: reviewerId,
    type:
      status === "approved"
        ? "timesheet_approved"
        : "timesheet_rejected",
    title:
      status === "approved"
        ? "Timesheet approved"
        : "Timesheet rejected",
    message:
      status === "approved"
        ? `${reviewer?.name || "Your reviewer"} approved your ${timesheet.hours}-hour timesheet.`
        : `${reviewer?.name || "Your reviewer"} rejected your ${timesheet.hours}-hour timesheet.${reviewComment?.trim() ? ` Comment: ${reviewComment.trim()}` : ""}`,
    link: "/timesheets",
  });
} catch (notificationError) {
  console.error("Timesheet review notification failed:", notificationError);
}

    await createActivityLog({
      actor: reviewerId,
      action: status === "approved" ? "approved" : "rejected",
      entityType: "task",
      entityId: String(timesheet._id),
      description: `Timesheet ${status}`,
      details: { employee: String(timesheet.employee), hours: timesheet.hours },
    });

    return res.json({
      message: `Timesheet ${status} successfully`,
      timesheet,
    });
  } catch (error) {
    console.error("Review timesheet error:", error);
    return res.status(500).json({ message: "Failed to review timesheet" });
  }
};
