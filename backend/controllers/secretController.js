import Secret from "../models/secretModel.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";

// ============================================================================
// VALIDATE SECRET INPUT
// ============================================================================

const SECRET_TYPES = [
  "tpin",
  "upi_pin",
  "atm_pin",
  "net_banking_password",
  "security_answer",
  "recovery_code",
  "other",
];

const validateSecretInput = (title, secretType, value) => {
  const errors = [];

  if (!title || !title.trim()) {
    errors.push("Title is required");
  }

  if (secretType && !SECRET_TYPES.includes(secretType)) {
    errors.push("Invalid secret type");
  }

  if (!value || String(value).trim().length === 0) {
    errors.push("Secret value is required");
  }

  return errors;
};

const decryptSecret = (item) => {
  const decrypted = { ...item };

  try {
    decrypted.value = decryptPassword(item.value);
  } catch (error) {
    console.error(`Failed to decrypt secret ${item._id}:`, error);
    decrypted.value = "";
  }

  return decrypted;
};

// ============================================================================
// POST /api/secrets
// CREATE SECRET
// ============================================================================

export const createSecret = async (req, res) => {
  try {
    const { title, secretType, value, issuer, notes } = req.body;

    const validationErrors = validateSecretInput(title, secretType, value);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const secretData = await Secret.create({
      user: req.user._id,
      title: title.trim(),
      secretType: secretType || "other",
      value: encryptPassword(String(value)),
      issuer: issuer?.trim() || null,
      notes: notes?.trim() || null,
    });

    const safeData = decryptSecret(secretData.toObject());

    return res.status(201).json({
      success: true,
      message: "Secret saved successfully",
      data: safeData,
    });
  } catch (error) {
    console.error("Error creating secret:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save secret",
    });
  }
};

// ============================================================================
// GET /api/secrets
// GET ALL SECRETS
// ============================================================================

export const getAllSecrets = async (req, res) => {
  try {
    const secrets = await Secret.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const decryptedSecrets = secrets.map(decryptSecret);

    return res.status(200).json({
      success: true,
      data: decryptedSecrets,
    });
  } catch (error) {
    console.error("Error fetching secrets:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch secrets",
    });
  }
};

// ============================================================================
// GET /api/secrets/:id
// GET SINGLE SECRET
// ============================================================================

export const getSecretById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid secret ID",
      });
    }

    const secretData = await Secret.findOne({ _id: id, user: req.user._id }).lean();

    if (!secretData) {
      return res.status(404).json({
        success: false,
        message: "Secret not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: decryptSecret(secretData),
    });
  } catch (error) {
    console.error("Error fetching secret:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch secret",
    });
  }
};

// ============================================================================
// PUT /api/secrets/:id
// UPDATE SECRET
// ============================================================================

export const updateSecret = async (req, res) => {
  try {
    const { id } = req.params;

    const { title, secretType, value, issuer, notes } = req.body;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid secret ID",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (secretType && !SECRET_TYPES.includes(secretType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid secret type",
      });
    }

    const updateData = {
      title: title.trim(),
      secretType: secretType || "other",
      issuer: issuer?.trim() || null,
      notes: notes?.trim() || null,
    };

    // Only re-encrypt when a new value is supplied
    if (value !== undefined && value !== "") {
      updateData.value = encryptPassword(String(value));
    }

    const updatedSecret = await Secret.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updateData,
      { new: true, runValidators: true },
    ).lean();

    if (!updatedSecret) {
      return res.status(404).json({
        success: false,
        message: "Secret not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Secret updated successfully",
      data: decryptSecret(updatedSecret),
    });
  } catch (error) {
    console.error("Error updating secret:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update secret",
    });
  }
};

// ============================================================================
// DELETE /api/secrets/:id
// DELETE SECRET
// ============================================================================

export const deleteSecret = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid secret ID",
      });
    }

    const deletedSecret = await Secret.findOneAndDelete({ _id: id, user: req.user._id });

    if (!deletedSecret) {
      return res.status(404).json({
        success: false,
        message: "Secret not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Secret deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting secret:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete secret",
    });
  }
};
