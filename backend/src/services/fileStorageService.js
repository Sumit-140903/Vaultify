
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, unlink } from "node:fs/promises";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

// Files are stored inside backend/private_uploads,
// not inside the public React frontend directory.
const PRIVATE_UPLOAD_DIRECTORY = path.resolve(
  currentDirectory,
  "../../private_uploads"
);

// Extensions are chosen by the server from the accepted MIME type.
// An uploaded filename never determines the filesystem path.
const MIME_EXTENSIONS = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

const ALLOWED_STORED_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/;

export async function storeUploadedFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("No valid uploaded file was provided.");
  }

  const extension = MIME_EXTENSIONS[file.mimetype];

  if (!extension) {
    throw new Error("This file type is not supported.");
  }

  // Calculate SHA-256 from the bytes received by the backend.
  const sha256 = crypto
    .createHash("sha256")
    .update(file.buffer)
    .digest("hex");

  // Generate the storage name ourselves.
  const storedName = `${crypto.randomUUID()}${extension}`;

  await mkdir(PRIVATE_UPLOAD_DIRECTORY, {
    recursive: true,
    mode: 0o700,
  });

  const filePath = path.join(PRIVATE_UPLOAD_DIRECTORY, storedName);

  // "wx" prevents accidentally overwriting an existing file.
  await writeFile(filePath, file.buffer, {
    flag: "wx",
    mode: 0o600,
  });

  return {
    storedName,
    sha256,
    size: file.buffer.length,
  };
}

export function getStoredFilePath(storedName) {
  if (
    typeof storedName !== "string" ||
    !ALLOWED_STORED_NAME.test(storedName)
  ) {
    throw new Error("Invalid stored filename.");
  }

  return path.join(PRIVATE_UPLOAD_DIRECTORY, storedName);
}

export async function deleteStoredFile(storedName) {
  const filePath = getStoredFilePath(storedName);

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
