
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",

  // Microsoft Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Microsoft Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // Microsoft PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text-based documents
  "text/plain",
  "text/csv",
]);

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
]);

const LEGACY_OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

// Legacy .doc, .xls and .ppt files use the same OLE container signature.
const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0,
  0xa1, 0xb1, 0x1a, 0xe1,
]);

function isLegacyOfficeContainer(buffer) {
  return (
    buffer.length >= OLE_SIGNATURE.length &&
    buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE)
  );
}

// Text and CSV files do not have a reliable binary magic signature.
// Validate that their contents are UTF-8 text, not arbitrary binary data.
function isValidTextFile(buffer) {
  try {
    const decoded = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(buffer);

    // Reject null bytes and unexpected control characters.
    // eslint-disable-next-line no-control-regex
    return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(decoded);
  } catch {
    return false;
  }
}

export async function validateFileContent(file) {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("Empty files cannot be uploaded.");
  }

  // Text and CSV require content-based text validation.
  if (TEXT_MIME_TYPES.has(file.mimetype)) {
    if (!isValidTextFile(file.buffer)) {
      throw new Error(
        "The uploaded file is not valid UTF-8 text or CSV content."
      );
    }

    return;
  }

  // Detect the actual binary format using its file signature.
  const detectedType = await fileTypeFromBuffer(file.buffer);

  if (!detectedType) {
    throw new Error(
      "The file format could not be identified. Upload a supported document."
    );
  }

  // Legacy Office formats share an OLE container signature.
  // This confirms the container, but not the exact Office document subtype.
  if (LEGACY_OFFICE_MIME_TYPES.has(file.mimetype)) {
    if (
      detectedType.mime !== "application/x-cfb" ||
      !isLegacyOfficeContainer(file.buffer)
    ) {
      throw new Error(
        "The uploaded file does not match a valid legacy Office container."
      );
    }

    return;
  }

  // For other supported binary formats, compare detected and claimed MIME.
  if (detectedType.mime !== file.mimetype) {
    throw new Error(
      "The file content does not match its declared file type."
    );
  }
}

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 10,
    parts: 12,
  },

  // Initial check based on the browser-provided MIME type.
  // Actual content validation happens after Multer receives the buffer.
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new Error(
          "Unsupported file type. Upload a PDF, common image, Word, Excel, PowerPoint, CSV, or text file."
        )
      );
    }

    callback(null, true);
  },
});

const multerUpload = upload.single("document");

export const uploadSingleDocument = (req, res, next) => {
  multerUpload(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            message: "File is too large. The maximum size is 10 MB.",
          });
        }

        return res.status(400).json({
          message: `File upload rejected: ${error.message}`,
        });
      }

      return res.status(400).json({
        message: error.message || "Unable to process the uploaded file.",
      });
    }

    // No file is valid for verification of an already-stored document.
    if (!req.file) {
      return next();
    }

    try {
      await validateFileContent(req.file);
      return next();
    } catch (validationError) {
      return res.status(400).json({
        message:
          validationError.message ||
          "The uploaded file failed content validation.",
      });
    }
  });
};
