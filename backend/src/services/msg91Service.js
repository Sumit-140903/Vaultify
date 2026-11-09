
import axios from "axios";

const MSG91_BASE_URL = "https://control.msg91.com/api/v5/otp";

const getConfig = () => {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is missing from backend .env");
  }

  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!templateId) {
    throw new Error("MSG91_TEMPLATE_ID is missing from backend .env");
  }

  return {
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 15000,
  };
};

const normalizeIndianMobile = (phone) => {
  if (typeof phone !== "string") {
    throw new Error("Enter a valid Indian mobile number");
  }

  const digits = phone.replace(/[\s\-()+]/g, "");

  // Accept either 9876543210 or 919876543210.
  const mobile = digits.startsWith("91") && digits.length === 12
    ? digits
    : digits.length === 10
      ? `91${digits}`
      : "";

  if (!/^91[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit Indian mobile number");
  }

  return mobile;
};

export const sendPhoneOtp = async (phone) => {
  const mobile = normalizeIndianMobile(phone);
  const config = getConfig();

  const response = await axios.post(
    MSG91_BASE_URL,
    {
      Param1: "Vaultify",
      Param2: "Registration",
      Param3: "Verification",
    },
    {
      ...config,
      params: {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile,
      },
    }
  );

  return response.data;
};

export const verifyPhoneOtpCode = async (phone, otp) => {
  const mobile = normalizeIndianMobile(phone);

  if (typeof otp !== "string" || !/^\d{4,8}$/.test(otp)) {
    throw new Error("Enter a valid OTP");
  }

  const response = await axios.get(`${MSG91_BASE_URL}/verify`, {
    ...getConfig(),
    params: {
      mobile,
      otp,
    },
  });

  return response.data;
};
