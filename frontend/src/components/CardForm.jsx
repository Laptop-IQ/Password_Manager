import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useEscapeKey from "../hooks/useEscapeKey";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_URL = `${API_BASE}/api`;

const EMPTY_FORM = {
  cardType: "debit",
  cardholderName: "",
  bankName: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
  pin: "",
  nickname: "",
  notes: "",
  category: "General",
  isFavorite: false,
};

const formatCardNumberInput = (value) =>
  value
    .replace(/[^\d]/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

export default function CardForm({ onClose, onSaved, token, editCard = null }) {
  const isEditMode = Boolean(editCard);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (editCard) {
      setFormData({
        cardType: editCard.cardType || "debit",
        cardholderName: editCard.cardholderName || "",
        bankName: editCard.bankName || "",
        cardNumber: formatCardNumberInput(editCard.cardNumber || ""),
        expiryMonth: editCard.expiryMonth || "",
        expiryYear: editCard.expiryYear || "",
        cvv: editCard.cvv || "",
        pin: editCard.pin || "",
        nickname: editCard.nickname || "",
        notes: editCard.notes || "",
        category: editCard.category || "General",
        isFavorite: Boolean(editCard.isFavorite),
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [editCard]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    const nextValue = name === "cardNumber" ? formatCardNumberInput(value) : value;

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleCancel = () => {
    if (loading) return;
    onClose?.();
  };

  const validate = () => {
    const errors = [];

    if (!formData.cardholderName.trim()) errors.push("Cardholder name is required.");
    if (!formData.bankName.trim()) errors.push("Bank / issuer name is required.");

    const digits = formData.cardNumber.replace(/\s/g, "");
    if (!/^\d{12,19}$/.test(digits)) errors.push("Card number must be 12-19 digits.");

    if (!formData.expiryMonth || Number(formData.expiryMonth) < 1 || Number(formData.expiryMonth) > 12) {
      errors.push("Expiry month must be between 01 and 12.");
    }

    if (!formData.expiryYear || String(formData.expiryYear).length !== 4) {
      errors.push("Expiry year must be a 4-digit year.");
    }

    if (!/^\d{3,4}$/.test(formData.cvv)) errors.push("CVV must be 3 or 4 digits.");

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const errors = validate();
    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    const id = editCard?._id || editCard?.id;
    if (isEditMode && !id) {
      toast.error("Invalid card ID.");
      return;
    }

    const payload = {
      ...formData,
      cardNumber: formData.cardNumber.replace(/\s/g, ""),
    };

    try {
      setLoading(true);

      if (isEditMode) {
        await axios.put(`${API_URL}/cards/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Card updated successfully.");
      } else {
        await axios.post(`${API_URL}/cards`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Card saved successfully.");
      }

      await onSaved?.();
    } catch (error) {
      console.error(isEditMode ? "Error updating card:" : "Error creating card:", error);

      const message =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.join(" ")
          : null) ||
        (isEditMode ? "Failed to update card." : "Failed to save card.");

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEscapeKey(handleCancel, !loading);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) handleCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="dialog max-w-[560px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="min-w-0">
            <h3 id="dialog-title" className="text-lg font-semibold tracking-tight text-ink">
            {isEditMode ? "Edit card" : "Add card"}
          </h3>
            <p className="text-[13px] text-muted mt-1">
            Card number, CVV and PIN are encrypted before they’re stored.
          </p>
          </div>
          <button type="button" onClick={handleCancel} aria-label="Close" className="icon-btn -mr-2 -mt-1 h-9 w-9 shrink-0 text-[22px]"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Card type */}
          <div className="flex gap-3">
            {["debit", "credit"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, cardType: type }))}
                disabled={loading}
                className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors capitalize ${
                  formData.cardType === type
                    ? "bg-primary border-primary text-white"
                    : "bg-canvas border-line text-ink hover:bg-sunken"
                }`}
              >
                {type} card
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-medium text-ink">
                Cardholder name
              </label>
              <input
                name="cardholderName"
                value={formData.cardholderName}
                onChange={handleChange}
                disabled={loading}
                placeholder="As printed on the card"
                className="field"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-medium text-ink">
                Bank / Issuer
              </label>
              <input
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. HDFC Bank"
                className="field"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-medium text-ink">
                Card number
              </label>
              <input
                name="cardNumber"
                value={formData.cardNumber}
                onChange={handleChange}
                disabled={loading}
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                className="field tracking-wider"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                Expiry month
              </label>
              <input
                name="expiryMonth"
                value={formData.expiryMonth}
                onChange={handleChange}
                disabled={loading}
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                className="field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                Expiry year
              </label>
              <input
                name="expiryYear"
                value={formData.expiryYear}
                onChange={handleChange}
                disabled={loading}
                inputMode="numeric"
                placeholder="YYYY"
                maxLength={4}
                className="field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                CVV
              </label>
              <div className="relative">
                <input
                  name="cvv"
                  type={showCvv ? "text" : "password"}
                  value={formData.cvv}
                  onChange={handleChange}
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="•••"
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCvv((v) => !v)}
                  className="icon-btn absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-[16px]"
                >
                  <i className={showCvv ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" /><span className="sr-only">{showCvv ? "Hide" : "Show"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                ATM / Card PIN (optional)
              </label>
              <div className="relative">
                <input
                  name="pin"
                  type={showPin ? "text" : "password"}
                  value={formData.pin}
                  onChange={handleChange}
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="icon-btn absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-[16px]"
                >
                  <i className={showPin ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" /><span className="sr-only">{showPin ? "Hide" : "Show"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-medium text-ink">
                Nickname (optional)
              </label>
              <input
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. Salary account debit card"
                className="field"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-medium text-ink">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                disabled={loading}
                className="field resize-none h-auto py-2.5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">Category</label>
              <input
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
                placeholder="General"
                className="field"
              />
            </div>

            <div className="space-y-1.5 flex items-end">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors ${
                  formData.isFavorite
                    ? "bg-warn-tint border-warn/30 text-warn"
                    : "bg-canvas border-line text-muted hover:text-ink"
                }`}
              >
                <i className={`${formData.isFavorite ? "ri-star-fill" : "ri-star-line"} text-[16px]`} aria-hidden="true" />
                Favorite
              </button>
            </div>
          </div>
        </div>

        <div className="bg-sunken/50 border-t border-line px-6 py-4 flex justify-end gap-2 rounded-b-[14px]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading && (
              <span className="spinner w-4 h-4" />
            )}
            {isEditMode ? "Save changes" : "Save card"}
          </button>
        </div>
      </form>
    </div>
  );
}
