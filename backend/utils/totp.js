import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Allow a ±1 step (30s) clock drift window — standard practice.
authenticator.options = { window: 1 };

const APP_NAME = "SecureVault";

export const generateTotpSecret = () => authenticator.generateSecret();

export const buildOtpAuthUrl = (accountEmail, secret) =>
  authenticator.keyuri(accountEmail, APP_NAME, secret);

export const generateQrCodeDataUrl = async (otpAuthUrl) =>
  QRCode.toDataURL(otpAuthUrl);

export const verifyTotpCode = (code, secret) => {
  try {
    return authenticator.verify({ token: String(code).trim(), secret });
  } catch {
    return false;
  }
};

// ---- One-time recovery codes (shown once, stored hashed) ----

export const generateRecoveryCodes = (count = 8) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10-char code
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
};

export const hashRecoveryCodes = async (codes) =>
  Promise.all(codes.map((code) => bcrypt.hash(code, 10)));

export const matchRecoveryCode = async (code, hashedCodes) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(code, hashedCodes[i])) {
      return i;
    }
  }
  return -1;
};
