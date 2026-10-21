
import type { Response } from "express";
import mongoose from "mongoose";
import CalendarEvent from "../models/CalendarEvent";
import Project from "../models/Project";
import Task from "../models/Task";
import Leave from "../models/Leave";
import type { AuthRequest } from "../middleware/auth";
import User from "../models/User";

function parseDateRange(query: AuthRequest["query"]) {
  const startValue = query.startDate;
  const endValue = query.endDate;

  const startDate =
    typeof startValue === "string" ? new Date(startValue) : undefined;
  const endDate =
    typeof endValue === "string" ? new Date(endValue) : undefined;

  if (
    !startDate ||
    !endDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    return null;
  }

  return { startDate, endDate };
}

export async function getCalendarEvents(
  req: AuthRequest,
  res: Response
) {
  const range = parseDateRange(req.query);

  if (!range) {
    return res.status(400).json({
      success: false,
      message: "Valid startDate and endDate query parameters are required"
    });
  }

  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({
      success: false,
      message: "Invalid authenticated user"
    });
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const projectFilter: Record<string, unknown> =
    role === "admin"
      ? {}
      : { $or: [{ owner: userObjectId }, { members: userObjectId }] };

  const taskFilter: Record<string, unknown> =
    role === "admin"
      ? {}
      : { assignedTo: userObjectId };

  const leaveFilter: Record<string, unknown> =
    role === "admin" || role === "manager"
      ? {}
      : { employee: userObjectId };

  const [projects, tasks, leaves, customEvents] = await Promise.all([
    
Project.find({
  ...projectFilter,
  status: { $ne: "archived" },
  $and: [
    {
      $or: [
        {
          startDate: {
            $gte: range.startDate,
            $lte: range.endDate
          }
        },
        {
          deadline: {
            $gte: range.startDate,
            $lte: range.endDate
          }
        }
      ]
    }
  ]
}).select("name startDate deadline status owner members"),

    Task.find({
      ...taskFilter,
      dueDate: { $gte: range.startDate, $lte: range.endDate }
    })
      .populate("project", "name")
      .populate("assignedTo", "name")
      .select("title dueDate status priority project assignedTo"),

    Leave.find({
      ...leaveFilter,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: range.endDate },
      endDate: { $gte: range.startDate }
    })
      .populate("employee", "name")
      .select("employee leaveType startDate endDate status"),

    CalendarEvent.find({
      startDate: { $lte: range.endDate },
      endDate: { $gte: range.startDate },
      $or: [
        { createdBy: userObjectId },
        { attendees: userObjectId }
      ]
    })
      .populate("createdBy", "name")
      .populate("attendees", "name email")
  ]);

  const events = [
   
    ...projects.flatMap((project) => {
      const items = [];

      if (
        project.startDate &&
        new Date(project.startDate) >= range.startDate &&
        new Date(project.startDate) <= range.endDate
      ) {
        items.push({
          id: `${project.id}-start`,
          type: "project-start",
          title: `${project.name} starts`,
          date: project.startDate,
          status: project.status
        });
      }

      if (
        project.deadline &&
        new Date(project.deadline) >= range.startDate &&
        new Date(project.deadline) <= range.endDate
      ) {
        items.push({
          id: `${project.id}-deadline`,
          type: "project-deadline",
          title: `${project.name} deadline`,
          date: project.deadline,
          status: project.status
        });
      }

      return items;
    }),


    ...tasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      date: task.dueDate,
      status: task.status,
      priority: task.priority,
      project: task.project,
      assignedTo: task.assignedTo
    })),

    ...leaves.map((leave) => ({
      id: leave.id,
      type: "leave",
      title: `${leave.leaveType} leave`,
      startDate: leave.startDate,
      endDate: leave.endDate,
      status: leave.status,
      employee: leave.employee
    })),


    ...customEvents.map((event) => ({


       id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      createdBy: event.createdBy,
      attendees: event.attendees
    }))
  ];
  
events.sort((a, b) => {
  const dateA = "date" in a ? a.date : a.startDate;
  const dateB = "date" in b ? b.date : b.startDate;

  const timeA = dateA ? new Date(dateA).getTime() : 0;
  const timeB = dateB ? new Date(dateB).getTime() : 0;

  return timeA - timeB;
});

  return res.status(200).json({
    success: true,
    count: events.length,
    events
  });
}

export async function createCalendarEvent(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user"
      });
    }

    const {
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      attendees
    } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length < 3 ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Title (minimum 3 characters), startDate and endDate are required"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid dates are required and endDate must be after startDate"
      });
    }

    if (
      type !== undefined &&
      !["meeting", "team-event"].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Type must be meeting or team-event"
      });
    }

    if (
      attendees !== undefined &&
      (!Array.isArray(attendees) ||
        attendees.some((id: unknown) =>
          typeof id !== "string" || !mongoose.isValidObjectId(id)
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Attendees must be an array of valid user IDs"
      });
    }

   const attendeeIds: string[] = attendees ?? [];

if (new Set(attendeeIds).size !== attendeeIds.length) {
  return res.status(400).json({
    success: false,
    message: "Duplicate attendee IDs are not allowed"
  });
}

if (attendeeIds.length > 0) {
  const existingUsers = await User.find({
    _id: { $in: attendeeIds }
  }).select("_id");

  if (existingUsers.length !== attendeeIds.length) {
    return res.status(400).json({
      success: false,
      message: "One or more attendees do not exist"
    });
  }
}

    const event = await CalendarEvent.create({
      title: title.trim(),
      description,
      type: type ?? "meeting",
      startDate: start,
      endDate: end,
      location,
      createdBy: userId,
      attendees: attendees ?? []
    });

    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate("createdBy", "name")
      .populate("attendees", "name email");

    return res.status(201).json({
      success: true,
      message: "Calendar event created successfully",
      event: populatedEvent
    });
  } catch (error) {
    console.error("Create calendar event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create calendar event"
    });
  }
}


export async function updateCalendarEvent(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const eventId = req.params.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user"
      });
    }

    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID"
      });
    }

    const event = await CalendarEvent.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found"
      });
    }
 if (
      event.createdBy.toString() !== userId &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this event"
      });
    }

    const {
      title,
      description,
      type,
      startDate,
      endDate,
      location,
      attendees
    } = req.body;

    if (
      title !== undefined &&
      (typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 150)
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must be between 3 and 150 characters"
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 3000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string of at most 3000 characters"
      });
    }

    if (
      type !== undefined &&
      !["meeting", "team-event"].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Type must be meeting or team-event"
      });
    }
    if (
      location !== undefined &&
      (typeof location !== "string" || location.length > 250)
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must be a string of at most 250 characters"
      });
    }

    if (
      attendees !== undefined &&
      (!Array.isArray(attendees) ||
        attendees.some((id: unknown) =>
          typeof id !== "string" || !mongoose.isValidObjectId(id)
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Attendees must be an array of valid user IDs"
      });
    }

    if (attendees !== undefined) {
  const attendeeIds = [...new Set(attendees as string[])];

  if (attendeeIds.length !== attendees.length) {
    return res.status(400).json({
      success: false,
      message: "Duplicate attendee IDs are not allowed"
    });
  }

  if (attendeeIds.length > 0) {
    const existingUsers = await User.find({
      _id: { $in: attendeeIds }
    }).select("_id");

    if (existingUsers.length !== attendeeIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more attendees do not exist"
      });
    }
  }
}

    const nextStart = startDate !== undefined
      ? new Date(startDate)
      : event.startDate;

    const nextEnd = endDate !== undefined
      ? new Date(endDate)
      : event.endDate;

    if (
      Number.isNaN(nextStart.getTime()) ||
      Number.isNaN(nextEnd.getTime()) ||
      nextStart >= nextEnd
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid dates are required and endDate must be after startDate"
      });
    }
     if (title !== undefined) event.title = title.trim();
    if (description !== undefined) event.description = description;
    if (type !== undefined) event.type = type;
    if (startDate !== undefined) event.startDate = nextStart;
    if (endDate !== undefined) event.endDate = nextEnd;
    if (location !== undefined) event.location = location.trim();
    if (attendees !== undefined) {
      event.attendees = attendees.map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );
    }

    await event.save();

    const updatedEvent = await CalendarEvent.findById(event._id)
      .populate("createdBy", "name")
      .populate("attendees", "name email");

    return res.status(200).json({
      success: true,
      message: "Calendar event updated successfully",
      event: updatedEvent
    });
  } catch (error) {
    console.error("Update calendar event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update calendar event"
    });
  }
}

export async function deleteCalendarEvent(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    const eventId = req.params.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user"
      });
    }

    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar event ID"
      });
    }

    const event = await CalendarEvent.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found"
      });
    }

    
    if (
      event.createdBy.toString() !== userId &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this event"
      });
    }

    await CalendarEvent.findByIdAndDelete(eventId);

    return res.status(200).json({
      success: true,
      message: "Calendar event deleted successfully"
    });
  } catch (error) {
    console.error("Delete calendar event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete calendar event"
    });
  }
}
