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

export const SECRET_TYPES = [
  { value: "tpin", label: "TPIN (Trading PIN)" },
  { value: "upi_pin", label: "UPI PIN" },
  { value: "atm_pin", label: "ATM PIN" },
  { value: "net_banking_password", label: "Net Banking Password" },
  { value: "security_answer", label: "Security Answer" },
  { value: "recovery_code", label: "Recovery Code" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  title: "",
  secretType: "tpin",
  value: "",
  issuer: "",
  notes: "",
  category: "General",
  isFavorite: false,
};

export default function SecretForm({ onClose, onSaved, token, editSecret = null }) {
  const isEditMode = Boolean(editSecret);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showValue, setShowValue] = useState(false);

  useEffect(() => {
    if (editSecret) {
      setFormData({
        title: editSecret.title || "",
        secretType: editSecret.secretType || "tpin",
        value: editSecret.value || "",
        issuer: editSecret.issuer || "",
        notes: editSecret.notes || "",
        category: editSecret.category || "General",
        isFavorite: Boolean(editSecret.isFavorite),
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [editSecret]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    if (loading) return;
    onClose?.();
  };

  const validate = () => {
    const errors = [];
    if (!formData.title.trim()) errors.push("Title is required.");
    if (!formData.value.trim()) errors.push("Secret value is required.");
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

    const id = editSecret?._id || editSecret?.id;
    if (isEditMode && !id) {
      toast.error("Invalid secret ID.");
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        await axios.put(`${API_URL}/secrets/${id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Secret updated successfully.");
      } else {
        await axios.post(`${API_URL}/secrets`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Secret saved successfully.");
      }

      await onSaved?.();
    } catch (error) {
      console.error(isEditMode ? "Error updating secret:" : "Error creating secret:", error);

      const message =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.join(" ")
          : null) ||
        (isEditMode ? "Failed to update secret." : "Failed to save secret.");

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
        className="w-full max-w-[480px] bg-[#130F1F]/95 backdrop-blur-xl rounded-[20px] shadow-2xl border border-white/10 my-auto"
      >
        <div className="p-6 border-b border-white/10">
          <h3 className="text-[20px] font-bold text-[#F5F3FF]">
            {isEditMode ? "Edit Secret" : "Add Secret / TPIN"}
          </h3>
          <p className="text-[13px] text-[#A8A4BD] mt-1">
            Use this for TPINs, UPI PINs, security answers, or any other sensitive code.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Type
            </label>
            <select
              name="secretType"
              value={formData.secretType}
              onChange={handleChange}
              disabled={loading}
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
            >
              {SECRET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Title
            </label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. Zerodha TPIN"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Issuer / Provider (optional)
            </label>
            <input
              name="issuer"
              value={formData.issuer}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. Zerodha, ICICI Bank"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Value
            </label>
            <div className="relative">
              <input
                name="value"
                type={showValue ? "text" : "password"}
                value={formData.value}
                onChange={handleChange}
                disabled={loading}
                placeholder={isEditMode ? "Leave unchanged to keep current value" : "Enter the PIN / code"}
                className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 pr-14 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
              />
              <button
                type="button"
                onClick={() => setShowValue((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#C9BFFF] font-medium"
              >
                {showValue ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              disabled={loading}
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#F5F3FF]">Category</label>
              <input
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={loading}
                placeholder="General"
                className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25 focus:border-[#8B72FF]"
              />
            </div>
            <div className="space-y-1.5 flex items-end">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold border transition-colors ${
                  formData.isFavorite
                    ? "bg-[#FBBF24]/15 border-[#FBBF24]/30 text-[#FBBF24]"
                    : "bg-black/20 border-white/10 text-[#A8A4BD] hover:text-white"
                }`}
              >
                {formData.isFavorite ? "★" : "☆"} Favorite
              </button>
            </div>
          </div>
        </div>

        <div className="bg-black/20 border-t border-white/10 p-5 flex justify-end gap-3 rounded-b-[20px]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-5 py-2.5 text-[14px] font-medium text-[#F5F3FF] hover:bg-white/5 rounded-[10px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#8B72FF] hover:bg-[#765be8] disabled:bg-[#4B4560] text-white text-[14px] font-medium rounded-[10px] flex items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isEditMode ? "Update Secret" : "Save Secret"}
          </button>
        </div>
      </form>
    </div>
  );
}
