import nodemailer from "nodemailer";

export const sendOtpEmail = async (email, otp) => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_APP_PASSWORD;

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "SMTP_USER or SMTP_APP_PASSWORD is missing from backend/.env"
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPassword.replace(/\s/g, ""),
    },
  });

  await transporter.sendMail({
    from: {
      name: "Vaultify",
      address: smtpUser,
    },
    to: email,
    subject: "Your Vaultify verification code",
    text: `Your Vaultify verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
        <h2>Verify your Vaultify account</h2>
        <p>Use the verification code below to continue:</p>
        <p style="font-size: 30px; font-weight: bold; letter-spacing: 8px;">
          ${otp}
        </p>
        <p>This code expires in 5 minutes. Do not share it with anyone.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `,
  });
};