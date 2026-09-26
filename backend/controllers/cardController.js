import Card from "../models/cardModel.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";

// ============================================================================
// HELPERS
// ============================================================================

const CARD_TYPES = ["debit", "credit"];

// Strips spaces/dashes so "4111 1111 1111 1111" and "4111-1111-1111-1111"
// are both accepted, then keeps only digits.
const normalizeCardNumber = (value) =>
  String(value || "").replace(/[\s-]/g, "");

// Luhn checksum — catches typos without needing a real card network call.
const isValidLuhn = (digits) => {
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const maskCardNumber = (digits) => {
  if (!digits || digits.length < 4) return "••••";
  return `•••• •••• •••• ${digits.slice(-4)}`;
};

const validateCardInput = ({
  cardType,
  cardholderName,
  bankName,
  cardNumber,
  expiryMonth,
  expiryYear,
  cvv,
}) => {
  const errors = [];

  if (!CARD_TYPES.includes(cardType)) {
    errors.push("Card type must be either 'debit' or 'credit'");
  }

  if (!cardholderName || !cardholderName.trim()) {
    errors.push("Cardholder name is required");
  }

  if (!bankName || !bankName.trim()) {
    errors.push("Bank / issuer name is required");
  }

  const digits = normalizeCardNumber(cardNumber);

  if (!/^\d{12,19}$/.test(digits)) {
    errors.push("Card number must be 12-19 digits");
  } else if (!isValidLuhn(digits)) {
    errors.push("Card number appears to be invalid");
  }

  const month = Number(expiryMonth);

  if (!month || month < 1 || month > 12) {
    errors.push("Expiry month must be between 01 and 12");
  }

  const year = Number(expiryYear);

  if (!year || String(expiryYear).length !== 4 || year < new Date().getFullYear()) {
    errors.push("Expiry year is invalid");
  }

  if (!cvv || !/^\d{3,4}$/.test(String(cvv))) {
    errors.push("CVV must be 3 or 4 digits");
  }

  return errors;
};

const decryptCard = (item) => {
  const decrypted = { ...item };

  try {
    const cardNumber = decryptPassword(item.cardNumber);
    decrypted.cardNumber = cardNumber;
    decrypted.maskedCardNumber = maskCardNumber(cardNumber);
  } catch (error) {
    console.error(`Failed to decrypt card number for card ${item._id}:`, error);
    decrypted.cardNumber = "";
    decrypted.maskedCardNumber = "••••";
  }

  try {
    decrypted.cvv = decryptPassword(item.cvv);
  } catch (error) {
    console.error(`Failed to decrypt CVV for card ${item._id}:`, error);
    decrypted.cvv = "";
  }

  if (item.pin) {
    try {
      decrypted.pin = decryptPassword(item.pin);
    } catch (error) {
      console.error(`Failed to decrypt PIN for card ${item._id}:`, error);
      decrypted.pin = "";
    }
  }

  return decrypted;
};

// ============================================================================
// POST /api/cards
// CREATE CARD
// ============================================================================

export const createCard = async (req, res) => {
  try {
    const {
      cardType,
      cardholderName,
      bankName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      pin,
      nickname,
      notes,
      category,
      isFavorite,
    } = req.body;

    const validationErrors = validateCardInput({
      cardType,
      cardholderName,
      bankName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const digits = normalizeCardNumber(cardNumber);

    const cardData = await Card.create({
      user: req.user._id,
      cardType,
      cardholderName: cardholderName.trim(),
      bankName: bankName.trim(),
      cardNumber: encryptPassword(digits),
      expiryMonth: String(expiryMonth).padStart(2, "0"),
      expiryYear: String(expiryYear),
      cvv: encryptPassword(String(cvv)),
      pin: pin ? encryptPassword(String(pin)) : null,
      nickname: nickname?.trim() || null,
      notes: notes?.trim() || null,
      category: category?.trim() || "General",
      isFavorite: Boolean(isFavorite),
    });

    const safeData = decryptCard(cardData.toObject());

    return res.status(201).json({
      success: true,
      message: "Card saved successfully",
      data: safeData,
    });
  } catch (error) {
    console.error("Error creating card:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save card",
    });
  }
};

// ============================================================================
// GET /api/cards
// GET ALL CARDS
// ============================================================================

export const getAllCards = async (req, res) => {
  try {
    const cards = await Card.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const decryptedCards = cards.map(decryptCard);

    return res.status(200).json({
      success: true,
      data: decryptedCards,
    });
  } catch (error) {
    console.error("Error fetching cards:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cards",
    });
  }
};

// ============================================================================
// GET /api/cards/:id
// GET SINGLE CARD
// ============================================================================

export const getCardById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid card ID",
      });
    }

    const cardData = await Card.findOne({ _id: id, user: req.user._id }).lean();

    if (!cardData) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: decryptCard(cardData),
    });
  } catch (error) {
    console.error("Error fetching card:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch card",
    });
  }
};

// ============================================================================
// PUT /api/cards/:id
// UPDATE CARD
// ============================================================================

export const updateCard = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid card ID",
      });
    }

    const {
      cardType,
      cardholderName,
      bankName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      pin,
      nickname,
      notes,
      category,
      isFavorite,
    } = req.body;

    const validationErrors = validateCardInput({
      cardType,
      cardholderName,
      bankName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const digits = normalizeCardNumber(cardNumber);

    const updateData = {
      cardType,
      cardholderName: cardholderName.trim(),
      bankName: bankName.trim(),
      cardNumber: encryptPassword(digits),
      expiryMonth: String(expiryMonth).padStart(2, "0"),
      expiryYear: String(expiryYear),
      cvv: encryptPassword(String(cvv)),
      pin: pin ? encryptPassword(String(pin)) : null,
      nickname: nickname?.trim() || null,
      notes: notes?.trim() || null,
      category: category?.trim() || "General",
      isFavorite: Boolean(isFavorite),
    };

    const updatedCard = await Card.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updateData,
      { new: true, runValidators: true },
    ).lean();

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Card updated successfully",
      data: decryptCard(updatedCard),
    });
  } catch (error) {
    console.error("Error updating card:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update card",
    });
  }
};

// ============================================================================
// DELETE /api/cards/:id
// DELETE CARD
// ============================================================================

export const deleteCard = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid card ID",
      });
    }

    const deletedCard = await Card.findOneAndDelete({ _id: id, user: req.user._id });

    if (!deletedCard) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Card deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting card:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete card",
    });
  }
};
