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

const EMPTY_FORM = { issuer: "", accountName: "", secret: "", category: "General", notes: "" };

export default function AuthenticatorForm({ onClose, onSaved, token, editItem = null }) {
  const isEditMode = Boolean(editItem);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setFormData({
        issuer: editItem.issuer || "",
        accountName: editItem.accountName || "",
        secret: "",
        category: editItem.category || "General",
        notes: editItem.notes || "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [editItem]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    if (loading) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.issuer.trim()) {
      toast.error("Issuer / service name is required.");
      return;
    }
    if (!isEditMode && !formData.secret.trim()) {
      toast.error("Authenticator secret is required.");
      return;
    }

    const id = editItem?._id || editItem?.id;

    try {
      setLoading(true);

      if (isEditMode) {
        await axios.put(`${API_URL}/totp/${id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Authenticator updated.");
      } else {
        await axios.post(`${API_URL}/totp`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Authenticator added.");
      }

      await onSaved?.();
    } catch (error) {
      console.error("Error saving authenticator:", error);
      const message =
        error?.response?.data?.message ||
        (isEditMode ? "Failed to update authenticator." : "Failed to save authenticator.");
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
            {isEditMode ? "Edit authenticator" : "Add authenticator"}
          </h3>
            <p className="text-[13px] text-muted mt-1">
            Store a TOTP secret to get 6-digit codes for another site’s two-factor login.
          </p>
          </div>
          <button type="button" onClick={handleCancel} aria-label="Close" className="icon-btn -mr-2 -mt-1 h-9 w-9 shrink-0 text-[22px]"><i className="ri-close-line" aria-hidden="true" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">Issuer / Service</label>
            <input
              name="issuer"
              value={formData.issuer}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. GitHub, Google"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">Account (optional)</label>
            <input
              name="accountName"
              value={formData.accountName}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. you@example.com"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">
              Secret key {isEditMode && <span className="text-muted font-normal">(leave blank to keep current)</span>}
            </label>
            <input
              name="secret"
              value={formData.secret}
              onChange={handleChange}
              disabled={loading}
              placeholder="Base32 secret from the site's QR setup"
              className="field font-mono"
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

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-ink">Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              disabled={loading}
              className="field resize-none h-auto py-2.5"
            />
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
            {loading && <span className="spinner w-4 h-4" />}
            {isEditMode ? "Save changes" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
