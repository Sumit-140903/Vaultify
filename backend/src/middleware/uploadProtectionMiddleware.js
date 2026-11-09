import { rateLimit } from "express-rate-limit";

// Limits upload attempts across both document and comparison uploads.
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,

  // Authentication must run before this middleware.
  // Count requests per Vaultify account, not per browser IP.
  keyGenerator: (req) => req.user._id.toString(),

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message:
      "Too many upload attempts. Please try again after 15 minutes.",
  },
});



// Separate limits for the multi-step private Blob upload flow.
// Each limit is scoped to the authenticated Vaultify account.
const createBlobRouteLimiter = (message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => req.user._id.toString(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

export const blobUploadIntentRateLimiter = createBlobRouteLimiter(
  "Too many upload authorizations. Please try again after 15 minutes."
);

export const blobUploadCompletionRateLimiter = createBlobRouteLimiter(
  "Too many upload completions. Please try again after 15 minutes."
);

export const blobUploadCancellationRateLimiter = createBlobRouteLimiter(
  "Too many upload cancellations. Please try again after 15 minutes."
);

// Keep memory usage under control when Multer uses memory storage.
const MAX_CONCURRENT_UPLOADS = 3;

let activeUploads = 0;

export const limitConcurrentUploads = (req, res, next) => {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    return res
      .status(503)
      .set("Retry-After", "5")
      .json({
        message:
          "The upload service is currently busy. Please try again shortly.",
      });
  }

  activeUploads += 1;

  // Release the slot when the request finishes or its connection closes.
  // The guard prevents releasing the same slot twice.
  let released = false;

  const releaseSlot = () => {
    if (released) return;

    released = true;
    activeUploads = Math.max(0, activeUploads - 1);
  };

  res.once("finish", releaseSlot);
  res.once("close", releaseSlot);

  next();
};