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
        className="dialog max-w-[480px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="min-w-0">
            <h3 id="dialog-title" className="text-lg font-semibold tracking-tight text-ink">
            {isEditMode ? "Edit secret" : "Add secret"}
          </h3>
            <p className="text-[13px] text-muted mt-1">
            Use this for TPINs, UPI PINs, security answers, or any other sensitive code.
          </p>
          </div>
          <button type="button" onClick={handleCancel} aria-label="Close" className="icon-btn -mr-2 -mt-1 h-9 w-9 shrink-0 text-[22px]"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Type
            </label>
            <select
              name="secretType"
              value={formData.secretType}
              onChange={handleChange}
              disabled={loading}
              className="field"
            >
              {SECRET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Title
            </label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. Zerodha TPIN"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Issuer / Provider (optional)
            </label>
            <input
              name="issuer"
              value={formData.issuer}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. Zerodha, ICICI Bank"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
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
                className="field pr-14"
              />
              <button
                type="button"
                onClick={() => setShowValue((v) => !v)}
                className="icon-btn absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 text-[16px]"
              >
                <i className={showValue ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" /><span className="sr-only">{showValue ? "Hide" : "Show"}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              disabled={loading}
              className="field resize-none h-auto py-2.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            {isEditMode ? "Save changes" : "Save secret"}
          </button>
        </div>
      </form>
    </div>
  );
}
