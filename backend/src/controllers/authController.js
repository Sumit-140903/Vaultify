import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  createAndSendEmailOtp,
  verifyEmailOtp,
} from "../services/otpService.js";

export const createToken = (userId) =>
  jwt.sign(
    { sub: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

export const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  phone: user.phone,
  emailVerified: user.emailVerified,
  phoneVerified: user.phoneVerified,
  walletAddress: user.walletAddress,
});

export const requestRegistrationEmailOtp = async (req, res) => {
  try {
    const { email } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    await createAndSendEmailOtp(normalizedEmail, "register");

    return res.json({
      message: "Verification code sent to your email",
    });
  } catch (error) {
    const isCooldown = error.message.includes("wait 60 seconds");
    const isConfigurationError =
      error.message.includes("missing from .env");

    console.error("Registration OTP request failed:", error.message);

    return res.status(
      isCooldown ? 429 : isConfigurationError ? 503 : 400
    ).json({
      message: isCooldown || isConfigurationError
        ? error.message
        : "Unable to send the verification code. Please try again.",
    });
  }
};

export const verifyRegistrationEmailOtp = async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body ?? {};

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Enter your full name (2–100 characters)",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    if (
      typeof phone !== "string" ||
      !/^[6-9]\d{9}$/.test(phone.trim())
    ) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Password must contain between 8 and 128 characters",
      });
    }

    if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Enter the six-digit email verification code",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = `+91${phone.trim()}`;

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    if (await User.findOne({ phone: normalizedPhone })) {
      return res.status(409).json({
        message: "An account with this phone number already exists",
      });
    }

    // Consume the valid OTP before creating the account.
    await verifyEmailOtp(normalizedEmail, otp, "register");

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      emailVerified: true,
      phoneVerified: false,
    });

    const token = createToken(user._id);

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email or phone number already exists",
      });
    }

    if (
      error.message === "Code is invalid or expired" ||
      error.message === "Too many attempts. Request a new code"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      message: "Unable to complete registration. Please try again.",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Enter your email and password",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before signing in",
      });
    }

    const token = createToken(user._id);

    return res.json({
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      message: "Unable to sign in. Please try again.",
    });
  }
};
export const getCurrentUser = (req, res) => {
  return res.json({
    user: publicUser(req.user),
  });
};