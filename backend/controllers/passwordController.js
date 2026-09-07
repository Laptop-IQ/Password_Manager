import Password from "../models/passwordModel.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";

// ============================================================================
// VALIDATE PASSWORD INPUT
// ============================================================================

const validatePasswordInput = (websiteName, url, password) => {
  const errors = [];

  if (!websiteName || websiteName.trim().length === 0) {
    errors.push("Website name is required");
  }

  if (!url || url.trim().length === 0) {
    errors.push("URL is required");
  }

  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  return errors;
};

// ============================================================================
// POST /api/passwords
// CREATE PASSWORD
// ============================================================================

export const createPassword = async (req, res) => {
  try {
    const { websiteName, url, password, username, notes } = req.body;

    const validationErrors = validatePasswordInput(websiteName, url, password);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // IMPORTANT:
    // Password manager needs reversible encryption.
    const encryptedPassword = encryptPassword(password);

    const passwordData = await Password.create({
      websiteName: websiteName.trim(),
      url: url.trim(),
      password: encryptedPassword,
      username: username?.trim() || null,
      notes: notes?.trim() || null,
    });

    const safeData = passwordData.toObject();

    // Return decrypted password to authenticated user
    safeData.password = password;

    return res.status(201).json({
      success: true,
      message: "Password saved successfully",
      data: safeData,
    });
  } catch (error) {
    console.error("Error creating password:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save password",
    });
  }
};

// ============================================================================
// GET /api/passwords
// GET ALL PASSWORDS
// ============================================================================

export const getAllPasswords = async (req, res) => {
  try {
    // IMPORTANT:
    // Do NOT use .select("-password")
    const passwords = await Password.find().sort({ createdAt: -1 }).lean();

    const decryptedPasswords = passwords.map((item) => {
      try {
        return {
          ...item,
          password: decryptPassword(item.password),
        };
      } catch (error) {
        console.error(`Failed to decrypt password ${item._id}:`, error);

        return {
          ...item,
          password: "",
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: decryptedPasswords,
    });
  } catch (error) {
    console.error("Error fetching passwords:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch passwords",
    });
  }
};

// ============================================================================
// GET /api/passwords/:id
// GET SINGLE PASSWORD
// ============================================================================

export const getPasswordById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid password ID",
      });
    }

    const passwordData = await Password.findById(id).lean();

    if (!passwordData) {
      return res.status(404).json({
        success: false,
        message: "Password not found",
      });
    }

    passwordData.password = decryptPassword(passwordData.password);

    return res.status(200).json({
      success: true,
      data: passwordData,
    });
  } catch (error) {
    console.error("Error fetching password:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch password",
    });
  }
};

// ============================================================================
// PUT /api/passwords/:id
// UPDATE PASSWORD
// ============================================================================

export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;

    const { websiteName, url, password, username, notes } = req.body;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid password ID",
      });
    }

    if (!websiteName || websiteName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Website name is required",
      });
    }

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    const updateData = {
      websiteName: websiteName.trim(),
      url: url.trim(),
      username: username?.trim() || null,
      notes: notes?.trim() || null,
    };

    // Only encrypt when a new password is supplied
    if (password !== undefined && password !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      updateData.password = encryptPassword(password);
    }

    const updatedPassword = await Password.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updatedPassword) {
      return res.status(404).json({
        success: false,
        message: "Password not found",
      });
    }

    // Return decrypted password
    updatedPassword.password = decryptPassword(updatedPassword.password);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
      data: updatedPassword,
    });
  } catch (error) {
    console.error("Error updating password:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update password",
    });
  }
};

// ============================================================================
// DELETE /api/passwords/:id
// DELETE PASSWORD
// ============================================================================

export const deletePassword = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid password ID",
      });
    }

    const deletedPassword = await Password.findByIdAndDelete(id);

    if (!deletedPassword) {
      return res.status(404).json({
        success: false,
        message: "Password not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting password:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete password",
    });
  }
};
