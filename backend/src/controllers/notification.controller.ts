import type { Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification";
import type { AuthRequest } from "../middleware/auth";

export async function listNotifications(
  req: AuthRequest,
  res: Response
) {
     try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      recipient: req.user!.id,
    };
 if (req.query.isRead === "true") {
      filter.isRead = true;
    } else if (req.query.isRead === "false") {
      filter.isRead = false;
    }
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate("sender", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List notifications error:", error);
    return res.status(500).json({
      message: "Failed to fetch notifications",
    });
  }
}
export async function getUnreadCount(
  req: AuthRequest,
  res: Response
) {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user!.id,
      isRead: false,
    });

    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error("Unread count error:", error);
    return res.status(500).json({
      message: "Failed to fetch unread count",
    });
  }
}


export async function markNotificationRead(
  req: AuthRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user!.id,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );



    if (!notification){
      return res.status(404).json({
        message: "Notification not found",
      });




    }

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      message: "Failed to update notification",
    });


  }
}



export async function markAllNotificationsRead(
  req: AuthRequest,
  res: Response
) {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user!.id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  }  catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({
       message: "Failed to update notifications",
    });
  }
}