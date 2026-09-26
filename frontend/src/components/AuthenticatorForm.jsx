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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto"
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
            {isEditMode ? "Edit Authenticator" : "Add Authenticator"}
          </h3>
          <p className="text-[13px] text-[#A8A4BD] mt-1">
            Store a TOTP secret to generate 6-digit codes for another site's 2FA.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">Issuer / Service</label>
            <input
              name="issuer"
              value={formData.issuer}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. GitHub, Google"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">Account (optional)</label>
            <input
              name="accountName"
              value={formData.accountName}
              onChange={handleChange}
              disabled={loading}
              placeholder="e.g. you@example.com"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">
              Secret key {isEditMode && <span className="text-[#A8A4BD] font-normal">(leave blank to keep current)</span>}
            </label>
            <input
              name="secret"
              value={formData.secret}
              onChange={handleChange}
              disabled={loading}
              placeholder="Base32 secret from the site's QR setup"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">Category</label>
            <input
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={loading}
              placeholder="General"
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-[#F5F3FF]">Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              disabled={loading}
              className="w-full bg-black/20 border border-white/10 text-[#F5F3FF] text-[14px] px-4 py-2.5 rounded-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-[#8B72FF]/25"
            />
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
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEditMode ? "Update" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
