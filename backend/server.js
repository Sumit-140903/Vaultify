
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import documentRoutes from "./src/routes/documentRoutes.js";
import verificationRoutes from "./src/routes/verificationRoutes.js";
import walletRoutes from "./src/routes/walletRoutes.js";

const app = express();

app.use(helmet());

// Allow explicitly configured frontend origins.
// FRONTEND_URLS supports comma-separated origins; FRONTEND_URL
// remains supported for existing development configurations.
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are server-to-server or local
      // tooling requests and are not subject to browser CORS enforcement.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin is not allowed by CORS.");
      error.code = "CORS_ORIGIN_BLOCKED";
      return callback(error);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

 // Establish or reuse the MongoDB connection before handling requests.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});


app.get("/", (req, res) => {
  res.json({
    message: "Vaultify API is running",
    status: "OK",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/verifications", verificationRoutes);
app.use("/api/wallet", walletRoutes);

// Return a consistent JSON response for unknown routes.
app.use((req, res) => {
  return res.status(404).json({
    message: "API endpoint not found.",
  });
});

// Centralized error handler. Do not expose internal stack traces.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "CORS_ORIGIN_BLOCKED") {
    return res.status(403).json({
      message: "This origin is not allowed to access the API.",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON request body.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large.",
    });
  }

  console.error("Unhandled API error:", {
    method: req.method,
    path: req.path,
    message: error.message,
  });

  return res.status(500).json({
    message: "An unexpected server error occurred.",
  });
});

export default app;
