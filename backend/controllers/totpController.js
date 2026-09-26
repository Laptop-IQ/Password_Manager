import Totp from "../models/totpModel.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";

const normalizeSecret = (value) =>
  String(value || "")
    .replace(/\s|-/g, "")
    .toUpperCase();

const isValidBase32 = (value) => /^[A-Z2-7]+=*$/.test(value) && value.length >= 8;

const decryptTotp = (item) => {
  const decrypted = { ...item };
  try {
    decrypted.secret = decryptPassword(item.secret);
  } catch (error) {
    console.error(`Failed to decrypt TOTP secret ${item._id}:`, error);
    decrypted.secret = "";
  }
  return decrypted;
};

export const createTotp = async (req, res) => {
  try {
    const { issuer, accountName, secret, category, notes } = req.body;

    if (!issuer || !issuer.trim()) {
      return res.status(400).json({ success: false, message: "Issuer / service name is required" });
    }

    const cleanSecret = normalizeSecret(secret);
    if (!isValidBase32(cleanSecret)) {
      return res.status(400).json({
        success: false,
        message: "Secret must be a valid Base32 authenticator key (usually 16-32 characters, e.g. from a QR setup code).",
      });
    }

    const totpData = await Totp.create({
      user: req.user._id,
      issuer: issuer.trim(),
      accountName: accountName?.trim() || null,
      secret: encryptPassword(cleanSecret),
      category: category?.trim() || "General",
      notes: notes?.trim() || null,
    });

    return res.status(201).json({
      success: true,
      message: "Authenticator added",
      data: decryptTotp(totpData.toObject()),
    });
  } catch (error) {
    console.error("Error creating TOTP entry:", error);
    return res.status(500).json({ success: false, message: "Failed to save authenticator" });
  }
};

export const getAllTotp = async (req, res) => {
  try {
    const items = await Totp.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: items.map(decryptTotp) });
  } catch (error) {
    console.error("Error fetching TOTP entries:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch authenticators" });
  }
};

export const updateTotp = async (req, res) => {
  try {
    const { id } = req.params;
    const { issuer, accountName, secret, category, notes, isFavorite } = req.body;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const updateData = {};

    if (issuer !== undefined) {
      if (!issuer.trim()) {
        return res.status(400).json({ success: false, message: "Issuer / service name is required" });
      }
      updateData.issuer = issuer.trim();
    }

    if (accountName !== undefined) updateData.accountName = accountName?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || "General";
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (isFavorite !== undefined) updateData.isFavorite = Boolean(isFavorite);

    if (secret !== undefined && secret !== "") {
      const cleanSecret = normalizeSecret(secret);
      if (!isValidBase32(cleanSecret)) {
        return res.status(400).json({ success: false, message: "Invalid Base32 secret" });
      }
      updateData.secret = encryptPassword(cleanSecret);
    }

    const updated = await Totp.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updateData,
      { new: true, runValidators: true },
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({ success: true, message: "Authenticator updated", data: decryptTotp(updated) });
  } catch (error) {
    console.error("Error updating TOTP entry:", error);
    return res.status(500).json({ success: false, message: "Failed to update authenticator" });
  }
};

export const deleteTotp = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const deleted = await Totp.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({ success: true, message: "Authenticator deleted" });
  } catch (error) {
    console.error("Error deleting TOTP entry:", error);
    return res.status(500).json({ success: false, message: "Failed to delete authenticator" });
  }
};
