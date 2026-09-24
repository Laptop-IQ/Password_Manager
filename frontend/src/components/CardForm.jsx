import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) handleCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[560px] bg-white rounded-[16px] shadow-2xl border border-[#e1e2ec] my-auto"
      >
        <div className="p-6 border-b border-[#e1e2ec]">
          <h3 className="text-[20px] font-bold text-[#191b23]">
            {isEditMode ? "Edit Card" : "Add Debit / Credit Card"}
          </h3>
          <p className="text-[13px] text-[#727785] mt-1">
            Card number, CVV, and PIN are encrypted before being stored.
          </p>
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
                className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold border transition-colors capitalize ${
                  formData.cardType === type
                    ? "bg-[#0058be] border-[#0058be] text-white"
                    : "bg-[#f9f9ff] border-[#e1e2ec] text-[#191b23] hover:bg-[#f2f3fd]"
                }`}
              >
                {type} card
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-semibold text-[#191b23]">
                Cardholder name
              </label>
              <input
                name="cardholderName"
                value={formData.cardholderName}
                onChange={handleChange}
                disabled={loading}
                placeholder="As printed on the card"
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-semibold text-[#191b23]">
                Bank / Issuer
              </label>
              <input
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. HDFC Bank"
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-semibold text-[#191b23]">
                Card number
              </label>
              <input
                name="cardNumber"
                value={formData.cardNumber}
                onChange={handleChange}
                disabled={loading}
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] tracking-wider focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#191b23]">
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
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#191b23]">
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
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#191b23]">
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
                  className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 pr-10 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
                />
                <button
                  type="button"
                  onClick={() => setShowCvv((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#0058be] font-medium"
                >
                  {showCvv ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#191b23]">
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
                  className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 pr-10 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#0058be] font-medium"
                >
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-semibold text-[#191b23]">
                Nickname (optional)
              </label>
              <input
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g. Salary account debit card"
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="block text-[13px] font-semibold text-[#191b23]">
                Notes (optional)
              </label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                disabled={loading}
                className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-2.5 rounded-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#f9f9ff] border-t border-[#e1e2ec] p-5 flex justify-end gap-3 rounded-b-[16px]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-5 py-2.5 text-[14px] font-medium text-[#191b23] hover:bg-[#f2f3fd] rounded-[10px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#0058be] hover:bg-[#004395] disabled:bg-[#b0b8cc] text-white text-[14px] font-medium rounded-[10px] flex items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isEditMode ? "Update Card" : "Save Card"}
          </button>
        </div>
      </form>
    </div>
  );
}
