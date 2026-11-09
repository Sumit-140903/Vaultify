
import {
  sendPhoneOtp,
  verifyPhoneOtpCode,
} from "../services/msg91Service.js";

export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body ?? {};

    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const providerResult = await sendPhoneOtp(phone);

    console.log("MSG91 send OTP response received.");

    return res.status(200).json({
      success: true,
      message: "OTP request submitted to MSG91",
      requestId: providerResult.request_id ?? providerResult.requestId ?? null,
    });
  } catch (error) {
    console.error(
      "MSG91 send OTP failed:",
      error.response?.status ?? error.message
    );

    return res.status(502).json({
      success: false,
      message: "Unable to send OTP. Check the phone number and MSG91 configuration.",
    });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body ?? {};

    if (
      typeof phone !== "string" ||
      typeof otp !== "string" ||
      !/^\d{4,8}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a phone number and valid OTP",
      });
    }

    const result = await verifyPhoneOtpCode(phone, otp);
    const message = String(result?.message ?? "").toLowerCase();
    const type = String(result?.type ?? "").toLowerCase();

    const verified =
      type === "success" ||
      message === "otp verified successfully" ||
      message === "verified";

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "OTP verification failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Phone OTP verified successfully",
    });
  } catch (error) {
    console.error(
      "MSG91 verify OTP failed:",
      error.response?.status ?? error.message
    );

    return res.status(502).json({
      success: false,
      message: "Unable to verify OTP with MSG91",
    });
  }
};
