import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const getKey = () => {
  const secret = process.env.PASSWORD_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("PASSWORD_ENCRYPTION_KEY is not configured");
  }

  // SHA-256 converts your env secret into exactly 32 bytes
  return crypto
    .createHash("sha256")
    .update(secret)
    .digest()
    .subarray(0, KEY_LENGTH);
};

export const encryptPassword = (password) => {
  const key = getKey();

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

export const decryptPassword = (encryptedPassword) => {
  const key = getKey();

  const [ivHex, authTagHex, encryptedHex] = encryptedPassword.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted password format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
