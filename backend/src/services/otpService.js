import crypto from "node:crypto";
import OTP from "../models/OTP.js";
import { sendOtpEmail } from "./emailService.js";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp, identifier, purpose) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${identifier}:${purpose}:${otp}`)
    .digest("hex");

export const createAndSendEmailOtp = async (
  email,
  purpose = "register"
) => {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await OTP.findOne({
    email: normalizedEmail,
    purpose,
  }).sort({ createdAt: -1 });

  if (
    existing &&
    Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new Error(
      "Please wait 60 seconds before requesting another code"
    );
  }

  const otp = crypto
    .randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");

  await OTP.deleteMany({
    email: normalizedEmail,
    purpose,
  });

  await OTP.create({
    email: normalizedEmail,
    purpose,
    otpHash: hashOtp(otp, normalizedEmail, purpose),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    attempts: 0,
    verified: false,
    lastSentAt: new Date(),
  });

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (error) {
    await OTP.deleteMany({
      email: normalizedEmail,
      purpose,
    });

    throw error;
  }
};

export const verifyEmailOtp = async (
  email,
  otp,
  purpose = "register"
) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Atomically reserve one attempt. Concurrent requests cannot
  // increment the same attempt counter using a stale database value.
  const record = await OTP.findOneAndUpdate(
    {
      email: normalizedEmail,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_ATTEMPTS },
    },
    {
      $inc: { attempts: 1 },
    },
    {
  returnDocument: "after",
  runValidators: true,
}
  ).select("+otpHash");

  if (!record) {
    const existing = await OTP.findOne({
      email: normalizedEmail,
      purpose,
      verified: false,
    }).select("attempts expiresAt");

    if (
      existing &&
      existing.expiresAt.getTime() > Date.now() &&
      existing.attempts >= MAX_ATTEMPTS
    ) {
      await OTP.deleteOne({
        _id: existing._id,
        verified: false,
        attempts: { $gte: MAX_ATTEMPTS },
      });

      throw new Error(
        "Too many attempts. Request a new code"
      );
    }

    throw new Error("Code is invalid or expired");
  }

  const expectedHash = hashOtp(
    otp,
    normalizedEmail,
    purpose
  );

  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(record.otpHash, "hex");

  const matches =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    if (record.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({
        _id: record._id,
        verified: false,
        attempts: { $gte: MAX_ATTEMPTS },
      });

      throw new Error(
        "Too many attempts. Request a new code"
      );
    }

    throw new Error("Code is invalid or expired");
  }

  // Only the request holding the current attempt number can mark
  // this OTP as verified. The condition prevents concurrent reuse.
  const result = await OTP.updateOne(
    {
      _id: record._id,
      verified: false,
      attempts: record.attempts,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { verified: true },
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("Code is invalid or expired");
  }

  return true;
};