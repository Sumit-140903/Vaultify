import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Please sign in.",
    });
  }

  const token = authorization.slice(7);

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Your session is invalid or expired. Please sign in again.",
    });
  }

  if (typeof payload.sub !== "string") {
    return res.status(401).json({
      message: "Invalid authentication token.",
    });
  }

  try {
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        message: "Account not found. Please sign in again.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Authentication lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to verify your account.",
    });
  }
};