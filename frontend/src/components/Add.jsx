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
  websiteName: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};

export default function AddNewPassword({
  handleOpenModal,
  onPasswordAdded,
  token,
  editPassword = null,
}) {
  const isEditMode = Boolean(editPassword);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // ============================================================
  // POPULATE EDIT DATA
  // ============================================================

  useEffect(() => {
    if (editPassword) {
      setFormData({
        websiteName: editPassword.websiteName || "",
        url: editPassword.url || "",
        username: editPassword.username || "",
        password: editPassword.password || "",
        notes: editPassword.notes || "",
      });

      // Edit me password visible rakhna optional hai.
      setShowPassword(false);
    } else {
      setFormData(EMPTY_FORM);
      setShowPassword(false);
    }
  }, [editPassword]);

  // ============================================================
  // CLOSE
  // ============================================================

  const handleCancel = () => {
    if (loading) return;

    setFormData(EMPTY_FORM);
    setShowPassword(false);

    if (handleOpenModal) {
      handleOpenModal();
    }
  };

  // ============================================================
  // INPUT CHANGE
  // ============================================================

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateForm = () => {
    const errors = [];

    if (!formData.websiteName.trim()) {
      errors.push("Website name is required.");
    }

    if (!formData.url.trim()) {
      errors.push("Website URL is required.");
    }

    if (!formData.password) {
      errors.push("Password is required.");
    } else if (formData.password.length < 6) {
      errors.push("Password must be at least 6 characters.");
    }

    return errors;
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const errors = validateForm();

    if (errors.length > 0) {
      toast.error(errors.join(" "));
      return;
    }

    const id = editPassword?._id || editPassword?.id;

    if (isEditMode && !id) {
      toast.error("Invalid password ID.");
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        // ======================================================
        // UPDATE
        // ======================================================

        await axios.put(`${API_URL}/passwords/${id}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        toast.success("Password updated successfully.");
      } else {
        // ======================================================
        // CREATE
        // ======================================================

        await axios.post(`${API_URL}/passwords`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        toast.success("Password saved successfully.");
      }

      // Parent refresh karega
      if (onPasswordAdded) {
        await onPasswordAdded();
      }
    } catch (error) {
      console.error(
        isEditMode ? "Error updating password:" : "Error creating password:",
        error,
      );

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.join(" ")
          : null) ||
        (isEditMode
          ? "Failed to update password."
          : "Failed to save password.");

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PASSWORD GENERATOR
  // ============================================================

  const generatePassword = () => {
    const length = 18;

    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";

    const allChars = uppercase + lowercase + numbers + symbols;

    const getRandomChar = (chars) =>
      chars[Math.floor(Math.random() * chars.length)];

    // Ensure generated password has all required character types
    const requiredChars = [
      getRandomChar(uppercase),
      getRandomChar(lowercase),
      getRandomChar(numbers),
      getRandomChar(symbols),
    ];

    const remainingLength = length - requiredChars.length;

    const remainingChars = Array.from({ length: remainingLength }, () =>
      getRandomChar(allChars),
    );

    const generated = [...requiredChars, ...remainingChars];

    // Fisher-Yates shuffle
    for (let i = generated.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));

      [generated[i], generated[randomIndex]] = [
        generated[randomIndex],
        generated[i],
      ];
    }

    setFormData((prev) => ({
      ...prev,
      password: generated.join(""),
    }));

    setShowPassword(true);

    toast.success("Strong password generated.", {
      autoClose: 1500,
    });
  };

  // ============================================================
  // PASSWORD STRENGTH
  // ============================================================

  const getPasswordStrength = () => {
    const pwd = formData.password;

    if (!pwd) {
      return {
        text: "None",
        color: "text-gray-400",
        bar: "bg-gray-300",
        width: "w-0",
      };
    }

    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);

    const score =
      Number(pwd.length >= 8) +
      Number(pwd.length >= 12) +
      Number(pwd.length >= 16) +
      Number(hasUppercase && hasLowercase) +
      Number(hasNumber) +
      Number(hasSymbol);

    if (score >= 6) {
      return {
        text: "Strong",
        color: "text-[#059669]",
        bar: "bg-[#059669]",
        width: "w-full",
      };
    }

    if (score >= 4) {
      return {
        text: "Good",
        color: "text-[#f59e0b]",
        bar: "bg-[#f59e0b]",
        width: "w-3/4",
      };
    }

    return {
      text: "Weak",
      color: "text-[#ba1a1a]",
      bar: "bg-[#ba1a1a]",
      width: "w-1/3",
    };
  };

  const strength = getPasswordStrength();

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 min-h-screen backdrop-blur-sm bg-[#9ca3af]/50 flex items-center justify-center p-4 font-sans z-50">
      <div className="bg-white w-full max-w-[850px] rounded-[20px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="p-8 pb-6 flex justify-between items-start border-b border-[#e1e2ec] bg-white z-10">
          <div>
            <h1 className="text-[22px] font-semibold text-[#191b23] leading-tight">
              {isEditMode ? "Edit Password" : "Add New Password"}
            </h1>

            <p className="text-[14px] text-[#727785] mt-1">
              {isEditMode
                ? "Update your saved credential details"
                : "Securely store a new credential"}
            </p>
          </div>

          <button
            type="button"
            className="text-[#727785] hover:text-[#191b23] transition-colors cursor-pointer p-2 hover:bg-[#f2f3fd] rounded-lg"
            onClick={handleCancel}
            disabled={loading}
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ======================================================
            FORM
        ====================================================== */}

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="px-8 py-6 flex flex-col md:flex-row gap-8">
            {/* ==================================================
                LEFT
            ================================================== */}

            <div className="flex-1 space-y-5">
              {/* Website Name */}

              <div className="space-y-2">
                <label
                  className="block text-[13px] font-semibold text-[#191b23]"
                  htmlFor="websiteName"
                >
                  Website Name
                </label>

                <input
                  className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-3 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785]"
                  placeholder="e.g. GitHub, Gmail, Netflix"
                  type="text"
                  id="websiteName"
                  name="websiteName"
                  value={formData.websiteName}
                  onChange={handleFormChange}
                  disabled={loading}
                  autoComplete="organization"
                />
              </div>

              {/* URL */}

              <div className="space-y-2">
                <label
                  className="block text-[13px] font-semibold text-[#191b23]"
                  htmlFor="url"
                >
                  Website URL
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#727785]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>

                  <input
                    className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] pl-10 pr-4 py-3 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785]"
                    placeholder="https://github.com"
                    type="url"
                    id="url"
                    name="url"
                    value={formData.url}
                    onChange={handleFormChange}
                    disabled={loading}
                    autoComplete="url"
                  />
                </div>
              </div>

              {/* Username */}

              <div className="space-y-2">
                <label
                  className="block text-[13px] font-semibold text-[#191b23]"
                  htmlFor="username"
                >
                  Username or Email
                </label>

                <input
                  className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-3 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785]"
                  placeholder="developer@example.com"
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              {/* Password */}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    className="block text-[13px] font-semibold text-[#191b23]"
                    htmlFor="password"
                  >
                    Password
                  </label>

                  <span
                    className={`text-[11px] font-bold tracking-wider ${strength.color}`}
                  >
                    {strength.text.toUpperCase()}
                  </span>
                </div>

                <div className="relative">
                  <input
                    className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] pl-4 pr-12 py-3 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785]"
                    placeholder="Enter a secure password"
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    disabled={loading}
                    autoComplete={
                      isEditMode ? "current-password" : "new-password"
                    }
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#727785] hover:text-[#191b23] cursor-pointer"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c7 0 10 7 10 8s-3 8-10 8a10.5 10.5 0 0 1-3-.4" />
                        <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3 7 10 7" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength */}

                <div className="h-1.5 bg-[#ecedf7] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strength.bar} ${strength.width} rounded-full transition-all`}
                  />
                </div>
              </div>

              {/* Notes */}

              <div className="space-y-2 pb-4">
                <label
                  className="block text-[13px] font-semibold text-[#191b23]"
                  htmlFor="notes"
                >
                  Notes (optional)
                </label>

                <textarea
                  className="w-full bg-[#f9f9ff] border border-[#e1e2ec] text-[#191b23] text-[14px] px-4 py-3 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785] resize-none"
                  placeholder="Add security questions or recovery codes..."
                  id="notes"
                  name="notes"
                  rows="3"
                  value={formData.notes}
                  onChange={handleFormChange}
                  disabled={loading}
                />
              </div>
            </div>

            {/* ==================================================
                GENERATOR
            ================================================== */}

            <div className="w-full md:w-[300px] bg-[#f9f9ff] border border-[#e1e2ec] rounded-[16px] p-6 flex flex-col h-fit">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[20px]">✨</span>

                <h3 className="text-[14px] font-semibold text-[#191b23]">
                  Generator
                </h3>
              </div>

              <button
                type="button"
                onClick={generatePassword}
                disabled={loading}
                className="w-full px-6 py-3 cursor-pointer flex items-center gap-2 justify-center bg-[#0058be] hover:bg-[#004395] disabled:bg-[#b0b8cc] text-white text-[14px] font-semibold rounded-[12px] shadow-sm transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Generate
              </button>

              <div className="mt-6 pt-6 border-t border-[#e1e2ec]">
                <p className="text-[11px] text-[#727785] leading-relaxed">
                  <strong>Pro tip:</strong> Use at least 16 characters with
                  uppercase, numbers, and symbols for maximum security.
                </p>
              </div>
            </div>
          </div>

          {/* ====================================================
              FOOTER
          ==================================================== */}

          <div className="bg-[#f9f9ff] border-t border-[#e1e2ec] p-6 flex justify-end items-center gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-5 py-2.5 cursor-pointer text-[14px] font-medium text-[#191b23] hover:bg-[#f2f3fd] rounded-[12px] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 cursor-pointer bg-[#0058be] hover:bg-[#004395] disabled:bg-[#b0b8cc] text-white text-[14px] font-medium rounded-[12px] flex items-center gap-2 shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />

                  {isEditMode ? "Updating..." : "Saving..."}
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />

                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>

                  {isEditMode ? "Update Securely" : "Save Securely"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
