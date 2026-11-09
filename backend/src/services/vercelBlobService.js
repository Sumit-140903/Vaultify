import crypto from "node:crypto";
import {
  issueSignedToken,
  presignUrl,
  get,
  del,
} from "@vercel/blob";

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const MIME_EXTENSIONS = Object.freeze({
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
});

export function isAllowedDocumentMimeType(mimeType) {
  return Object.hasOwn(MIME_EXTENSIONS, mimeType);
}

export function isDocumentPathForOwner(pathname, ownerId) {
  if (
    typeof pathname !== "string" ||
    typeof ownerId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(ownerId)
  ) {
    return false;
  }

  const extensions = Object.values(MIME_EXTENSIONS)
    .map((extension) => extension.slice(1))
    .join("|");

  const pattern = new RegExp(
    `^documents/${ownerId}/[0-9a-f-]{36}\\.(${extensions})$`,
    "i"
  );

  return pattern.test(pathname);
}

export async function createDocumentUploadUrl(ownerId, mimeType) {
  const normalizedOwnerId = String(ownerId);

  if (!/^[a-f0-9]{24}$/i.test(normalizedOwnerId)) {
    throw new Error("Invalid document owner.");
  }

  const extension = MIME_EXTENSIONS[mimeType];

  if (!extension) {
    throw new Error("This file type is not supported.");
  }

  const pathname =
    `documents/${normalizedOwnerId}/${crypto.randomUUID()}${extension}`;

  const validUntil = Date.now() + 5 * 60 * 1000;

  const signedToken = await issueSignedToken({
    pathname,
    operations: ["put"],
    validUntil,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES,
  });

  const { presignedUrl } = await presignUrl(signedToken, {
    pathname,
    operation: "put",
    access: "private",
    validUntil,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES,
    addRandomSuffix: false,
    allowOverwrite: false,
  });

  return {
    pathname,
    presignedUrl,
    expiresAt: validUntil,
  };
}


export async function createPrivateDocumentDownloadUrl(pathname, ownerId) {
  if (!isDocumentPathForOwner(pathname, String(ownerId))) {
    throw new Error("Document access denied.");
  }

  const validUntil = Date.now() + 5 * 60 * 1000;

  const signedToken = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });

  const { presignedUrl } = await presignUrl(signedToken, {
    pathname,
    operation: "get",
    access: "private",
    validUntil,
    useCache: false,
  });

  return {
    presignedUrl,
    expiresAt: validUntil,
  };
}

export async function readPrivateDocument(pathname) {
  const result = await get(pathname, {
    access: "private",
    useCache: false,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const arrayBuffer = await new Response(result.stream).arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: result.blob.contentType,
    size: result.blob.size,
    etag: result.blob.etag,
  };
}

export async function deletePrivateDocument(pathname) {
  await del(pathname);
}

export {
  createDocumentUploadUrl as createPrivateDocumentUploadUrl,
};
