import nodemailer from "nodemailer";

/**
 * Send email using Gmail SMTP
 * @param {string} to - Recipient
 * @param {string} subject - Email subject
 * @param {string} text - Email text
 */
export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"ExpenseTracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log("Email sent:", info.messageId);
  } catch (err) {
    console.error("sendEmail Error:", err);
    throw err;
  }
};
