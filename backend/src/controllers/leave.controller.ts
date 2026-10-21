import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Leave from "../models/Leave";

import Project from "../models/Project";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";
import { createNotification } from "../services/notification.service";

async function getManagerTeamIds(managerId: string) {
  const projects = await Project.find({
    $or: [
      { owner: managerId },
      { members: managerId }
    ],
    status: { $ne: "archived" }
  }).select("owner members");

  const teamIds = new Set<string>();

  for (const project of projects) {
    teamIds.add(project.owner.toString());

    for (const member of project.members) {
      teamIds.add(member.toString());
    }
  }

 
  teamIds.delete(managerId);

  return [...teamIds];
}

const createLeaveSchema = z.object({
  leaveType: z.enum(["casual", "sick", "earned", "unpaid"]),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().trim().min(5).max(1000)
});
const reviewLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewComment: z.string().trim().max(1000).optional().default("")
});
function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
export async function applyLeave(req: AuthRequest, res: Response) {
  try {
    const parsed = createLeaveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid leave request",
        errors: parsed.error.flatten()
      });
    }
      const { leaveType, startDate, endDate, reason } = parsed.data;
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (end < start) {
      return res.status(400).json({
        message: "End date cannot be before start date"
      });
    }
 const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        message: "Leave start date cannot be in the past"
      });
    }
     const employee = await User.findById(req.user!.id);

    if (!employee || !employee.isActive) {
      return res.status(403).json({
        message: "Active user account required"
      });
    }

    const overlap = await Leave.findOne({
      employee: employee._id,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    if (overlap) {
      return res.status(409).json({
        message: "You already have a pending or approved leave overlapping these dates"
      });
    }

    const leave = await Leave.create({
      employee: employee._id,
      leaveType,
      startDate: start,
      endDate: end,
      reason
    });

    return res.status(201).json({
      message: "Leave request submitted successfully",
      leave
    });
  } catch (error) {
    console.error("Apply leave error:", error);
    return res.status(500).json({
      message: "Failed to submit leave request"
    });
  }
}
export async function listLeaves(req: AuthRequest, res: Response) {
  try {
    const filter: Record<string, unknown> = {};

if (req.user!.role === "employee") {
  filter.employee = new mongoose.Types.ObjectId(req.user!.id);
} else if (req.user!.role === "manager") {
  const teamIds = await getManagerTeamIds(req.user!.id);

  filter.employee = {
    $in: teamIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
  };
}
            if (req.query.status !== undefined) {
      const parsedStatus = z.enum([
        "pending",
        "approved",
        "rejected",
        "cancelled"
      ]).safeParse(req.query.status);

      if (!parsedStatus.success) {
        return res.status(400).json({
          message: "Invalid leave status"
        });
      }

      filter.status = parsedStatus.data;
    }
const leaves = await Leave.find(filter)
      .populate("employee", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: leaves.length,
      leaves
    });
  } catch (error) {
    console.error("List leaves error:", error);
    return res.status(500).json({
      message: "Failed to fetch leave requests"
    });
  }
}
export async function getLeave(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }

    const leave = await Leave.findById(id)
      .populate("employee", "name email role")
      .populate("reviewedBy", "name email role");

    if (!leave) {
      return res.status(404).json({
        message: "Leave request not found"
      });
    }
     const employeeId = String(
      (leave.employee as unknown as { _id: mongoose.Types.ObjectId })._id
    );

    if (
      req.user!.role === "employee" &&
      employeeId !== req.user!.id
    ) {
      return res.status(403).json({
        message: "You cannot access this leave request"
      });
    }
    
    if (req.user!.role === "manager") {
      const teamIds = await getManagerTeamIds(req.user!.id);

      if (!teamIds.includes(employeeId)) {
        return res.status(403).json({
          message: "You can access leave requests only for your team"
        });
      }
    }


    return res.status(200).json({ leave });
  } catch (error) {
    console.error("Get leave error:", error);
    return res.status(500).json({
      message: "Failed to fetch leave request"
    });
  }
}
export async function reviewLeave(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }

    const parsed = reviewLeaveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid review data",
        errors: parsed.error.flatten()
      });
    }
     const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        message: "Leave request not found"
      });
    }

    if (leave.status !== "pending") {
      return res.status(409).json({
        message: "Only pending leave requests can be reviewed"
      });
    }

    if (leave.employee.toString() === req.user!.id) {
      return res.status(403).json({
        message: "You cannot review your own leave request"
      });
    }
    if (req.user!.role === "manager") {
  const teamIds = await getManagerTeamIds(req.user!.id);

  if (!teamIds.includes(leave.employee.toString())) {
    return res.status(403).json({
      message: "You can review leave requests only for your team"
    });
  }
}
    leave.status = parsed.data.status;
    leave.reviewComment = parsed.data.reviewComment;
    leave.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    leave.reviewedAt = new Date();

    await leave.save();
    
try {
  const isApproved = leave.status === "approved";

  await createNotification({
    recipient: leave.employee.toString(),
    sender: req.user!.id,
    type: isApproved ? "leave_approved" : "leave_rejected",
    title: isApproved ? "Leave approved" : "Leave rejected",
    message: isApproved
      ? "Your leave request has been approved."
      : "Your leave request has been rejected.",
    link: "/leaves",
  });
} catch (notificationError) {
  console.error(
    "Leave review notification failed:",
    notificationError
  );
}


    const populatedLeave = await Leave.findById(leave._id)
      .populate("employee", "name email role")
      .populate("reviewedBy", "name email role");

    return res.status(200).json({
      message: `Leave request ${parsed.data.status} successfully`,
      leave: populatedLeave
    });
  } catch (error) {
    console.error("Review leave error:", error);
    return res.status(500).json({
      message: "Failed to review leave request"
    });
  }
}
export async function cancelLeave(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid leave ID" });
    }

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        message: "Leave request not found"
      });
    }

    if (leave.employee.toString() !== req.user!.id) {
      return res.status(403).json({
        message: "You can cancel only your own leave request"
      });
    }
    if (leave.status !== "pending") {
      return res.status(409).json({
        message: "Only pending leave requests can be cancelled"
      });
    }

    leave.status = "cancelled";
    await leave.save();

    return res.status(200).json({
      message: "Leave request cancelled successfully",
      leave
    });
  } catch (error) {
    console.error("Cancel leave error:", error);
    return res.status(500).json({
      message: "Failed to cancel leave request"
    });
  }
}