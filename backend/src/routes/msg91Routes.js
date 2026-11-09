
import express from "express";
import {
  sendOtp,
  verifyPhoneOtp,
} from "../controllers/msg91Controller.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyPhoneOtp);

export default router;
