
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const uploadDir = path.resolve(process.cwd(), "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".txt",
  ".csv",
]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  callback
) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    callback(
      new Error("Unsupported file type. Allowed: PDF, DOCX, XLSX, PPTX, TXT, CSV.")
    );
    return;
  }

  if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
    callback(new Error("Unsupported MIME type for this file."));
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    files: 1,
  },
});

export default upload;
