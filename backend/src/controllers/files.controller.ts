import type { Response } from "express";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import Project from "../models/Project";
import WorkSphereFile from "../models/File";
import type { AuthRequest } from "../middleware/auth";
import { createActivityLog } from "../services/activityLog.service";

const uploadSchema = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid project ID"),
  description: z.string().trim().max(1000).optional().default(""),
});

const updateSchema = z.object({
  originalName: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Provide a filename or description to update",
});

function validId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

async function getAccessibleProject(projectId: string, userId: string, role: string) {
  if (!validId(projectId)) return null;

  const filter: Record<string, unknown> = { _id: projectId };

  if (role !== "admin") {
    filter.members = new mongoose.Types.ObjectId(userId);
  }

  return Project.findOne(filter).select("_id name members owner");
}

function getCategory(extension: string) {
  switch (extension) {
    case ".pdf":
    case ".docx":
      return "document";
    case ".xlsx":
    case ".csv":
      return "spreadsheet";
    case ".pptx":
      return "presentation";
    case ".txt":
      return "text";
    default:
      return "other";
  }
}

function safeFileResponse(file: any) {
  return {
    _id: file._id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    extension: file.extension,
    size: file.size,
    category: file.category,
    project: file.project,
    uploadedBy: file.uploadedBy,
    description: file.description,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export async function uploadProjectFile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const parsed = uploadSchema.safeParse({
    projectId: req.body?.projectId,
    description: req.body?.description ?? "",
  });

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid upload details",
      errors: parsed.error.issues,
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "Please attach a file using the 'file' field",
    });
    return;
  }

  try {
    const project = await getAccessibleProject(
      parsed.data.projectId,
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      await fs.unlink(req.file.path).catch(() => undefined);
      res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
      return;
    }
const extension = path.extname(req.file.originalname).toLowerCase();

    const file = await WorkSphereFile.create({
      originalName: path.basename(req.file.originalname),
      storedName: req.file.filename,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      extension,
      size: req.file.size,
      category: getCategory(extension),
      project: project._id,
      uploadedBy: new mongoose.Types.ObjectId(req.user!.id),
      description: parsed.data.description,
    });

    try {
      await createActivityLog({
        actor: req.user!.id,
        action: "created",
        entityType: "file",
        entityId: file._id.toString(),
        description: `Uploaded file: ${file.originalName}`,
        details: { projectId: project._id.toString() },
      });
    } catch (error) {
      console.error("File activity log failed:", error);
    }

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: safeFileResponse(file),
    });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => undefined);
    console.error("Upload file failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to upload file",
    });
  }
}

export async function listProjectFiles(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const projectId = req.query.projectId;

  if (!validId(projectId)) {
    res.status(400).json({
      success: false,
      message: "A valid projectId query parameter is required",
    });
    return;
  }

  try {
    const project = await getAccessibleProject(
      projectId,
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found or you do not have access",
      });
      return;
    }

    const files = await WorkSphereFile.find({ project: project._id })
      .populate("uploadedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: files.length,
      files: files.map(safeFileResponse),
    });
  } catch (error) {
    console.error("List files failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch files",
    });
  }
}

export async function getProjectFile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const fileId = req.params.fileId;

  if (!validId(fileId)) {
    res.status(400).json({ success: false, message: "Invalid file ID" });
    return;
  }

  try {
    const file = await WorkSphereFile.findById(fileId).populate(
      "uploadedBy",
      "name email role"
    );

    if (!file) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    const project = await getAccessibleProject(
      file.project.toString(),
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({
      success: true,
      file: safeFileResponse(file),
    });
  } catch (error) {
    console.error("Get file failed:", error);
    res.status(500).json({ success: false, message: "Unable to fetch file" });
  }
}

export async function downloadProjectFile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const fileId = req.params.fileId;

  if (!validId(fileId)) {
    res.status(400).json({ success: false, message: "Invalid file ID" });
    return;
  }

  try {
    const file = await WorkSphereFile.findById(fileId);

    if (!file) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    const project = await getAccessibleProject(
      file.project.toString(),
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const expectedPath = path.resolve(process.cwd(), "uploads", file.storedName);
    const actualPath = path.resolve(file.storagePath);

    if (
      path.dirname(actualPath) !== path.resolve(process.cwd(), "uploads") ||
      actualPath !== expectedPath
    ) {
      res.status(400).json({ success: false, message: "Invalid stored file path" });
      return;
    }

    await fs.access(actualPath);

    res.download(actualPath, path.basename(file.originalName), (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to download file",
        });
      }
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      res.status(404).json({
        success: false,
        message: "File is missing from local storage",
      });
      return;
    }

    console.error("Download file failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Unable to download file",
      });
    }
  }
}

export async function updateProjectFile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const fileId = req.params.fileId;
  const parsed = updateSchema.safeParse(req.body);

  if (!validId(fileId)) {
    res.status(400).json({ success: false, message: "Invalid file ID" });
    return;
  }

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid update details",
      errors: parsed.error.issues,
    });
    return;
  }

  try {
    const file = await WorkSphereFile.findById(fileId);

    if (!file) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    const project = await getAccessibleProject(
      file.project.toString(),
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }
 const isUploader = file.uploadedBy.toString() === req.user!.id;
    const isOwner = project.owner?.toString() === req.user!.id;

    if (req.user!.role !== "admin" && !isUploader && !isOwner) {
      res.status(403).json({
        success: false,
        message: "Only the uploader, project owner, or admin can update this file",
      });
      return;
    }

    if (parsed.data.originalName !== undefined) {
         const newName = path.basename(parsed.data.originalName).trim();
      if (
        !newName ||
        path.extname(newName).toLowerCase() !== file.extension
      ) {
        res.status(400).json({
          success: false,
          message: "Filename must retain its original extension",
        });
        return;
      }
      file.originalName = newName;
    }

    if (parsed.data.description !== undefined) {
      file.description = parsed.data.description;
    }

    await file.save();

    res.status(200).json({
      success: true,
      message: "File details updated successfully",
      file: safeFileResponse(file),
    });
  } catch (error) {
    console.error("Update file failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update file details",
    });
  }
}

export async function deleteProjectFile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const fileId = req.params.fileId;

  if (!validId(fileId)) {
    res.status(400).json({ success: false, message: "Invalid file ID" });
    return;
  }

  try {
    const file = await WorkSphereFile.findById(fileId);

    if (!file) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    const project = await getAccessibleProject(
      file.project.toString(),
      req.user!.id,
      req.user!.role
    );

    if (!project) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const isUploader = file.uploadedBy.toString() === req.user!.id;
    const isOwner = project.owner?.toString() === req.user!.id;

    if (req.user!.role !== "admin" && !isUploader && !isOwner) {
      res.status(403).json({
        success: false,
        message: "Only the uploader, project owner, or admin can delete this file",
      });
      return;
    }

    const expectedPath = path.resolve(process.cwd(), "uploads", file.storedName);
    const actualPath = path.resolve(file.storagePath);

    if (
      path.dirname(actualPath) !== path.resolve(process.cwd(), "uploads") ||
      actualPath !== expectedPath
    ) {
      res.status(400).json({ success: false, message: "Invalid stored file path" });
      return;
    }

    await WorkSphereFile.deleteOne({ _id: file._id });

    await fs.unlink(actualPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        console.error("Unable to remove stored file:", error);
      }
    });

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete file",
    });
  }
}