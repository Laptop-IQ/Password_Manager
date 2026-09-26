import Password from "../models/passwordModel.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";

const MAX_HISTORY_ENTRIES = 20;

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

const normalizeTags = (tags) => {
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : String(tags).split(",");
  return [...new Set(arr.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);
};

// ============================================================================
// POST /api/passwords
// CREATE PASSWORD
// ============================================================================

export const createPassword = async (req, res) => {
  try {
    const { websiteName, url, password, username, notes, category, tags, isFavorite } = req.body;

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
      user: req.user._id,
      websiteName: websiteName.trim(),
      url: url.trim(),
      password: encryptedPassword,
      username: username?.trim() || null,
      notes: notes?.trim() || null,
      category: category?.trim() || "General",
      tags: normalizeTags(tags),
      isFavorite: Boolean(isFavorite),
    });

    const safeData = passwordData.toObject();

    // Return decrypted password to authenticated user
    safeData.password = password;
    delete safeData.history;

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
    const passwords = await Password.find({ user: req.user._id })
      .select("-history") // history is fetched on demand (perf + keeps payload small)
      .sort({ createdAt: -1 })
      .lean();

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

    const passwordData = await Password.findOne({
      _id: id,
      user: req.user._id,
    }).lean();

    if (!passwordData) {
      return res.status(404).json({
        success: false,
        message: "Password not found",
      });
    }

    try {
      passwordData.password = decryptPassword(passwordData.password);
    } catch (error) {
      console.error(`Failed to decrypt password ${id}:`, error);
      passwordData.password = "";
    }

    delete passwordData.history;

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
// GET /api/passwords/:id/history
// GET PASSWORD CHANGE HISTORY (decrypted on demand)
// ============================================================================

export const getPasswordHistory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid password ID" });
    }

    const passwordData = await Password.findOne({ _id: id, user: req.user._id })
      .select("history")
      .lean();

    if (!passwordData) {
      return res.status(404).json({ success: false, message: "Password not found" });
    }

    const history = (passwordData.history || [])
      .slice()
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
      .map((entry) => {
        try {
          return { password: decryptPassword(entry.password), changedAt: entry.changedAt };
        } catch {
          return { password: "", changedAt: entry.changedAt };
        }
      });

    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error("Error fetching password history:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch password history" });
  }
};

// ============================================================================
// PUT /api/passwords/:id
// UPDATE PASSWORD
// ============================================================================

export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;

    const { websiteName, url, password, username, notes, category, tags, isFavorite } = req.body;

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

    if (category !== undefined) updateData.category = category?.trim() || "General";
    if (tags !== undefined) updateData.tags = normalizeTags(tags);
    if (isFavorite !== undefined) updateData.isFavorite = Boolean(isFavorite);

    // Only touch the password (and its history) when a new one is supplied.
    if (password !== undefined && password !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const existing = await Password.findOne({ _id: id, user: req.user._id })
        .select("password")
        .lean();

      if (!existing) {
        return res.status(404).json({ success: false, message: "Password not found" });
      }

      // Only record history if the password actually changed.
      let decryptedExisting = null;
      try {
        decryptedExisting = decryptPassword(existing.password);
      } catch {
        decryptedExisting = null;
      }

      if (decryptedExisting !== password) {
        await Password.updateOne(
          { _id: id, user: req.user._id },
          {
            $push: {
              history: {
                $each: [{ password: existing.password, changedAt: new Date() }],
                $position: 0,
                $slice: MAX_HISTORY_ENTRIES,
              },
            },
          },
        );
      }

      updateData.password = encryptPassword(password);
    }

    const updatedPassword = await Password.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updateData,
      { new: true, runValidators: true },
    )
      .select("-history")
      .lean();

    if (!updatedPassword) {
      return res.status(404).json({
        success: false,
        message: "Password not found",
      });
    }

    // Return decrypted password
    try {
      updatedPassword.password = decryptPassword(updatedPassword.password);
    } catch {
      updatedPassword.password = "";
    }

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

    const deletedPassword = await Password.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

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
