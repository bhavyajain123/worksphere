import type { Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Task from "../models/Task";
import Project from "../models/Project";
import User from "../models/User";
import type { AuthRequest } from "../middleware/auth";
import ActivityLog from "../models/ActivityLog";
import { createNotification } from "../services/notification.service";
import { createActivityLog } from "../services/activityLog.service";

const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000).optional().default(""),
  projectId: z.string().refine(mongoose.isValidObjectId, "Invalid project ID"),
  assignedTo: z.string().refine(mongoose.isValidObjectId, "Invalid employee ID"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().datetime().optional()
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(3000).optional(),
  assignedTo: z.string().refine(mongoose.isValidObjectId, "Invalid employee ID").optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]).optional(),
  dueDate: z.string().datetime().nullable().optional()
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  "At least one field is required"
);

function isValidId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}
function isAdmin(req: AuthRequest): boolean {
  return req.user?.role === "admin";
}
function canManageProject(
  project: { owner: unknown },
  userId: string,
  role: string
): boolean {
  return role === "admin" || String(project.owner) === userId;
}


export async function createTask(req: AuthRequest, res: Response) {
  try {
    const parsed = createTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid task data",
        errors: parsed.error.flatten()
      });
    }
     const { title, description, projectId, assignedTo, priority, dueDate } =
      parsed.data;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
     if (project.status === "archived") {
      return res.status(400).json({
        message: "Cannot create tasks in an archived project"
      });
    }

   const userId = req.user!.id;
const userRole = req.user!.role;

const isProjectOwner = project.owner.toString() === userId;

const isProjectMember = project.members.some(
  (memberId) => memberId.toString() === userId
);

const canCreateTask =
  userRole === "admin" ||
  isProjectOwner ||
  (userRole === "manager" && isProjectMember);

if (!canCreateTask) {
  return res.status(403).json({
    message: "You do not have permission to create tasks in this project"
  });
}
     const assignee = await User.findById(assignedTo);

    if (!assignee || !assignee.isActive) {
      return res.status(400).json({
        message: "Assigned employee does not exist or is inactive"
      });
    }

   const isAssigneeProjectMember = project.members.some(
  (memberId) => memberId.toString() === assignedTo
);

if (!isAssigneeProjectMember) {
      return res.status(400).json({
        message: "Assigned employee must be a member of the project"
      });
    }
 if (dueDate && Number.isNaN(Date.parse(dueDate))) {
      return res.status(400).json({ message: "Invalid due date" });
    }
      const task = await Task.create({
      title,
      description,
      project: project._id,
      assignedTo: assignee._id,
      createdBy: req.user!.id,
      priority: priority ?? "medium",
      dueDate: dueDate ? new Date(dueDate) : undefined
    });
    
try {
  await createNotification({
    recipient: assignee._id.toString(),
    sender: req.user!.id,
    type: "task_assigned",
    title: "New task assigned",
    message: `You have been assigned the task "${title}".`,
    link: "/tasks",
  });
} catch (notificationError) {
  console.error(
    "Task assignment notification failed:",
    notificationError
  );
}

try {
  await createActivityLog({
    actor: req.user!.id,
    action: "created",
    entityType: "task",
    entityId: task._id.toString(),
    description: `Created task: ${task.title}`,
    details: {
      projectId: task.project.toString(),
      assignedTo: task.assignedTo.toString(),
      priority: task.priority,
    },
  });
} catch (activityLogError) {
  console.error(
    "Task activity log failed:",
    activityLogError
  );
}


     const populatedTask = await Task.findById(task._id)
      .populate("project", "name status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email");

    return res.status(201).json({
      message: "Task created successfully",
      task: populatedTask
    });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({ message: "Failed to create task" });
  }
}
export async function listTasks(req: AuthRequest, res: Response) {
  try {
    
    const filter: Record<string, unknown> = {};
    let allowedProjectIds: mongoose.Types.ObjectId[] | null = null;

    if (req.user!.role === "employee") {
      filter.assignedTo = new mongoose.Types.ObjectId(req.user!.id);
    } else if (req.user!.role === "manager") {
const projects = await Project.find({
  $or: [
    { owner: req.user!.id },
    { members: req.user!.id }
  ],
  status: { $ne: "archived" }
}).select("_id");

      allowedProjectIds = projects.map((project) => project._id);
      filter.project = { $in: allowedProjectIds };
    }

    if (req.query.projectId !== undefined) {
      if (!isValidId(req.query.projectId)) {
        return res.status(400).json({
          message: "Invalid project ID"
        });
      }

      const requestedProjectId = new mongoose.Types.ObjectId(
        req.query.projectId as string
      );

      if (
        allowedProjectIds !== null &&
        !allowedProjectIds.some(
          (projectId) => projectId.equals(requestedProjectId)
        )
      ) {
        return res.status(403).json({
          message: "You cannot access tasks in this project"
        });
      }

      filter.project = requestedProjectId;
    }

    if (req.query.status !== undefined) {
      const status = z.enum([
        "todo",
        "in-progress",
        "review",
        "done"
      ]).safeParse(req.query.status);

      if (!status.success) {
        return res.status(400).json({ message: "Invalid task status" });
      }
      filter.status = status.data;
    }

    if (req.query.priority !== undefined) {
      const priority = z.enum([
        "low",
        "medium",
        "high",
        "urgent"
      ]).safeParse(req.query.priority);

      if (!priority.success) {
        return res.status(400).json({ message: "Invalid task priority" });
      }
      filter.priority = priority.data;
    }

    const tasks = await Task.find(filter)
      .populate("project", "name status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error("List tasks error:", error);
    return res.status(500).json({ message: "Failed to fetch tasks" });
  }
}
export async function getTask(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findById(id)
      .populate("project", "name owner members status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = task.project as unknown as {
      owner: mongoose.Types.ObjectId;
      members: mongoose.Types.ObjectId[];
    };

   
   
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const assignedUser = task.assignedTo as unknown as {
  _id: mongoose.Types.ObjectId;
};

const isAssignee = assignedUser._id.toString() === userId;
    const isProjectOwner = project.owner.toString() === userId;

    const isProjectMember = project.members.some(
      (memberId) => memberId.toString() === userId
    );

   
    const admin = isAdmin(req);

    const canManageTask =
      admin ||
      isProjectOwner ||
      (userRole === "manager" && isProjectMember);

    if (!canManageTask && !isAssignee) {
      return res.status(403).json({
        message: "You cannot access this task",
      });
    }


    return res.status(200).json({ task });
  } catch (error) {
    console.error("Get task error:", error);
    return res.status(500).json({ message: "Failed to fetch task" });
  }
}
export async function updateTask(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const parsed = updateTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid task update",
        errors: parsed.error.flatten()
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await Project.findById(task.project);

    if (!project) {
      return res.status(404).json({ message: "Task project not found" });
    }

    if (project.status === "archived") {
      return res.status(400).json({
        message: "Tasks in archived projects cannot be updated"
      });
    }
    
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const isAssignee = task.assignedTo.toString() === userId;
    const isProjectOwner = project.owner.toString() === userId;

    const isProjectMember = project.members.some(
      (memberId) => memberId.toString() === userId
    );

    const admin = isAdmin(req);

    const canManageTask =
      admin ||
      isProjectOwner ||
      (userRole === "manager" && isProjectMember);

    if (!canManageTask && !isAssignee) {
      return res.status(403).json({
        message: "You cannot update this task"
      });
    }


    const data = parsed.data;
    const previousAssigneeId = task.assignedTo.toString();
const previousStatus = task.status;
const previousTitle = task.title;
const previousPriority = task.priority;
    
   
    if (!canManageTask) {
      const keys = Object.keys(data);

      if (!isAssignee || keys.some((key) => key !== "status")) {
        return res.status(403).json({
          message: "Employees can only update their assigned task status"
        });
      }
    }

    if (data.assignedTo !== undefined) {
      const assignee = await User.findById(data.assignedTo);

      if (!assignee || !assignee.isActive) {
        return res.status(400).json({
          message: "Assigned employee does not exist or is inactive"
        });
      }

      const isMember = project.members.some(
        (memberId) => memberId.toString() === data.assignedTo
      );

      if (!isMember) {
        return res.status(400).json({
          message: "Assigned employee must be a member of the project"
        });
      }

      task.assignedTo = assignee._id;
    }

    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.status !== undefined) task.status = data.status;

    if (data.dueDate !== undefined) {
      if (data.dueDate === null) {
        task.dueDate = undefined;
      } else {
        const date = new Date(data.dueDate);
        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid due date" });
        }
        task.dueDate = date;
      }
    }
    await task.save();

    
const statusChanged = data.status !== undefined &&
  data.status !== previousStatus;

const assigneeChanged = data.assignedTo !== undefined &&
  data.assignedTo !== previousAssigneeId;

try {
  if (statusChanged) {
    await createActivityLog({
      actor: req.user!.id,
      action: "status_changed",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Changed task status from ${previousStatus} to ${task.status}: ${task.title}`,
      details: {
        previousStatus,
        newStatus: task.status,
      },
    });
  } else {
    await createActivityLog({
      actor: req.user!.id,
      action: "updated",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Updated task: ${task.title}`,
      details: {
        previousTitle,
        newTitle: task.title,
        previousPriority,
        newPriority: task.priority,
      },
    });
  }

  if (assigneeChanged) {
    await createActivityLog({
      actor: req.user!.id,
      action: "assigned",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Reassigned task "${task.title}"`,
      details: {
        previousAssigneeId,
        newAssigneeId: task.assignedTo.toString(),
      },
    });
  }
} catch (activityLogError) {
  console.error("Task update activity log failed:", activityLogError);
}

    
if (
  data.assignedTo !== undefined &&
  data.assignedTo !== previousAssigneeId
) {
  try {
    await createNotification({
      recipient: data.assignedTo,
      sender: req.user!.id,
      type: "task_assigned",
      title: "New task assigned",
      message: `You have been assigned the task "${task.title}".`,
      link: "/tasks",
    });
  } catch (notificationError) {
    console.error(
      "Task reassignment notification failed:",
      notificationError
    );
  }
}


    const populatedTask = await Task.findById(task._id)
      .populate("project", "name status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email");

    return res.status(200).json({
      message: "Task updated successfully",
      task: populatedTask
    });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({ message: "Failed to update task" });
  }
}


export async function deleteTask(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await Project.findById(task.project);

    if (!project) {
      return res.status(404).json({ message: "Task project not found" });
    }

    if (!isAdmin(req) && project.owner.toString() !== req.user!.id) {
      return res.status(403).json({
        message: "Only the project owner or an admin can delete tasks"
      });
    }

   
    const taskTitle = task.title;
    const taskId = task._id;
    const projectId = task.project;
    const actorId = req.user!.id;

    await task.deleteOne();

    await ActivityLog.create({
      actor: actorId,
      action: "deleted",
      entityType: "task",
      entityId: taskId,
      description: `Deleted task: ${taskTitle}`,
      details: {
        projectId: projectId.toString()
      }
    });

    return res.status(200).json({
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({
      message: "Failed to delete task"
    });
  }
}
