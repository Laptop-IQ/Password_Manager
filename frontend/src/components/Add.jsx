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
  websiteName: "",
  url: "",
  username: "",
  password: "",
  notes: "",
  category: "General",
  tags: "",
  isFavorite: false,
};

export default function AddNewPassword({
  handleOpenModal,
  onPasswordAdded,
  token,
  editPassword = null,
}) {
  const isEditMode = Boolean(editPassword);

  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Breach check (Have I Been Pwned, k-anonymity model): only the
  // first 5 chars of the password's SHA-1 hash ever leave the browser,
  // never the password itself.
  const [breachStatus, setBreachStatus] = useState({
    checking: false,
    breachCount: null, // null = unknown/not checked, 0 = clean, >0 = seen in breaches
  });

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
        category: editPassword.category || "General",
        tags: (editPassword.tags || []).join(", "),
        isFavorite: Boolean(editPassword.isFavorite),
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
        color: "text-ok",
        bar: "bg-ok",
        width: "w-full",
      };
    }

    if (score >= 4) {
      return {
        text: "Good",
        color: "text-warn",
        bar: "bg-warn",
        width: "w-3/4",
      };
    }

    return {
      text: "Weak",
      color: "text-danger",
      bar: "bg-danger",
      width: "w-1/3",
    };
  };

  const strength = getPasswordStrength();

  // ============================================================
  // BREACH CHECK (HaveIBeenPwned k-anonymity API)
  // Debounced: checks ~600ms after the user stops typing a password.
  // ============================================================

  useEffect(() => {
    const pwd = formData.password;

    if (!pwd || pwd.length < 4) {
      setBreachStatus({ checking: false, breachCount: null });
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setBreachStatus((prev) => ({ ...prev, checking: true }));

        const encoder = new TextEncoder();
        const data = encoder.encode(pwd);
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();

        const prefix = hashHex.slice(0, 5);
        const suffix = hashHex.slice(5);

        const res = await fetch(
          `https://api.pwnedpasswords.com/range/${prefix}`,
        );

        if (!res.ok) throw new Error("Breach check unavailable.");

        const text = await res.text();
        const match = text
          .split("\n")
          .map((line) => line.trim().split(":"))
          .find(([hashSuffix]) => hashSuffix === suffix);

        if (cancelled) return;

        const count = match ? parseInt(match[1], 10) : 0;
        setBreachStatus({ checking: false, breachCount: count });

        if (count > 0) {
          toast.warning(
            `This password has appeared in ${count.toLocaleString()} known data breaches. Choose a different one.`,
            { autoClose: 4000 },
          );
        }
      } catch {
        if (!cancelled) {
          // Fail silently/gracefully — never block saving just because
          // the breach-check service is unreachable.
          setBreachStatus({ checking: false, breachCount: null });
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData.password]);

  // ============================================================
  // COPY PASSWORD
  // ============================================================

  const handleCopyPassword = async () => {
    if (!formData.password) {
      toast.warning("Nothing to copy yet.");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formData.password);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = formData.password;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setPasswordCopied(true);
      toast.success("Password copied — clipboard clears in 20s.", {
        autoClose: 1500,
      });

      window.setTimeout(() => setPasswordCopied(false), 1500);

      // Security: clear the clipboard after a short delay if it still
      // holds the copied password.
      window.setTimeout(async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const current = await navigator.clipboard.readText();
            if (current === formData.password) {
              await navigator.clipboard.writeText("");
            }
          }
        } catch {
          // Best-effort only — ignore if clipboard read is blocked.
        }
      }, 20000);
    } catch {
      toast.error("Failed to copy password.");
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  useEscapeKey(handleCancel, !loading);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-dialog-title"
    >
      <div className="dialog max-w-[850px] flex flex-col overflow-hidden">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="px-6 py-5 sm:px-8 flex justify-between items-start border-b border-line bg-surface">
          <div>
            <h1 id="password-dialog-title" className="text-xl font-semibold tracking-tight text-ink leading-tight">
              {isEditMode ? "Edit password" : "Add password"}
            </h1>

            <p className="text-[14px] text-muted mt-1">
              {isEditMode
                ? "Update the saved login details"
                : "Stored encrypted. Only you can read it."}
            </p>
          </div>

          <button
            type="button"
            className="icon-btn h-9 w-9 text-[22px]"
            onClick={handleCancel}
            disabled={loading}
            aria-label="Close"
          >
            <i className="ri-close-line text-[24px]" aria-hidden="true" />
          </button>
        </div>

        {/* ======================================================
            FORM
        ====================================================== */}

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="px-6 py-6 sm:px-8 flex flex-col md:flex-row gap-8">
            {/* ==================================================
                LEFT
            ================================================== */}

            <div className="flex-1 space-y-5">
              {/* Website Name */}

              <div className="space-y-2">
                <label
                  className="block text-[13px] font-medium text-ink"
                  htmlFor="websiteName"
                >
                  Website name
                </label>

                <input
                  className="field"
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
                  className="block text-[13px] font-medium text-ink"
                  htmlFor="url"
                >
                  Website URL
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted">
                    <i className="ri-link text-[16px]" aria-hidden="true" />
                  </div>

                  <input
                    className="field pl-10 pr-4"
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
                  className="block text-[13px] font-medium text-ink"
                  htmlFor="username"
                >
                  Username or Email
                </label>

                <input
                  className="field"
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
                    className="block text-[13px] font-medium text-ink"
                    htmlFor="password"
                  >
                    Password
                  </label>

                  <span
                    className={`text-[11px] font-medium ${strength.color}`}
                  >
                    {strength.text}
                  </span>
                </div>

                <div className="relative">
                  <input
                    className="field pl-4 pr-20"
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

                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                    {/* Copy button */}

                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      disabled={loading || !formData.password}
                      className="icon-btn h-7 w-7 text-[16px]"
                      aria-label="Copy password"
                      title="Copy password"
                    >
                      {passwordCopied ? (
                        <i className="ri-check-line text-[18px] text-ok" aria-hidden="true" />
                      ) : (
                        <i className="ri-file-copy-line text-[18px]" aria-hidden="true" />
                      )}
                    </button>

                    {/* Show / hide button */}

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="icon-btn h-7 w-7 text-[16px]"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <i className="ri-eye-line text-[18px]" aria-hidden="true" />
                      ) : (
                        <i className="ri-eye-off-line text-[18px]" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Strength */}

                <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strength.bar}  ${strength.width} rounded-full transition-all`}
                  />
                </div>

                {/* Breach check status */}

                {breachStatus.checking ? (
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <span className="spinner w-3 h-3 inline-block" />
                    Checking known data breaches…
                  </p>
                ) : breachStatus.breachCount > 0 ? (
                  <p className="text-xs text-danger font-medium flex items-start gap-1.5">
                    <i className="ri-error-warning-line mt-px text-[14px]" aria-hidden="true" />
                    Seen in {breachStatus.breachCount.toLocaleString()}{" "}
                    known data breaches — pick a different password.
                  </p>
                ) : breachStatus.breachCount === 0 ? (
                  <p className="text-xs text-ok font-medium flex items-center gap-1.5">
                    <i className="ri-shield-check-line text-[14px]" aria-hidden="true" />
                    Not found in known breaches.
                  </p>
                ) : null}
              </div>

              {/* Notes */}

              <div className="space-y-2 pb-4">
                <label
                  className="block text-[13px] font-medium text-ink"
                  htmlFor="notes"
                >
                  Notes (optional)
                </label>

                <textarea
                  className="field resize-none h-auto py-2.5"
                  placeholder="Add security questions or recovery codes..."
                  id="notes"
                  name="notes"
                  rows="3"
                  value={formData.notes}
                  onChange={handleFormChange}
                  disabled={loading}
                />
              </div>

              {/* Category, Tags & Favorite */}

              <div className="grid grid-cols-2 items-end gap-3 pb-4">
                <div className="space-y-2">
                  <label className="block text-[13px] font-medium text-ink" htmlFor="category">
                    Category
                  </label>
                  <input
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    disabled={loading}
                    placeholder="General"
                    className="field"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[13px] font-medium text-ink" htmlFor="tags">
                    Tags
                  </label>
                  <input
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleFormChange}
                    disabled={loading}
                    placeholder="work, banking (comma separated)"
                    className="field"
                  />
                </div>
              </div>

              <div className="pb-4">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
                    formData.isFavorite
                      ? "bg-warn-tint border-warn/30 text-warn"
                      : "bg-surface border-line text-muted hover:text-ink"
                  }`}
                >
                  <i
                    className={`${formData.isFavorite ? "ri-star-fill" : "ri-star-line"} text-[16px]`}
                    aria-hidden="true"
                  />
                  Mark as favorite
                </button>
              </div>
            </div>

            {/* ==================================================
                GENERATOR
            ================================================== */}

            <div className="w-full md:w-[290px] bg-canvas border border-line rounded-xl p-5 flex flex-col h-fit md:shrink-0">
              <div className="mb-4">
                <h3 className="text-[14px] font-semibold text-ink">
                  Generator
                </h3>
              </div>

              <button
                type="button"
                onClick={generatePassword}
                disabled={loading}
                className="btn btn-primary w-full"
              >
                <i className="ri-refresh-line text-[16px]" aria-hidden="true" />
                Generate
              </button>

              <div className="mt-5 pt-5 border-t border-line">
                <p className="text-xs text-muted leading-relaxed">
                  <strong className="font-medium text-ink-soft">Tip:</strong> Use at least 16 characters with
                  uppercase, numbers and symbols.
                </p>
              </div>

              <div className="mt-5 pt-5 border-t border-line">
                <p className="text-xs text-muted leading-relaxed">
                  <strong className="font-medium text-ink-soft">Anti-scam reminder:</strong> Only enter
                  credentials on the site's real, verified URL. No legitimate
                  company will ever ask for your password by email, phone, or
                  text.
                </p>
              </div>
            </div>
          </div>

          {/* ====================================================
              FOOTER
          ==================================================== */}

          <div className="bg-sunken/50 border-t border-line px-6 py-4 sm:px-8 flex justify-end items-center gap-3">
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
              {loading ? (
                <>
                  <div className="spinner w-4 h-4" />

                  {isEditMode ? "Saving" : "Saving"}
                </>
              ) : (
                <>
                  <i className="ri-lock-line text-[16px]" aria-hidden="true" />

                  {isEditMode ? "Save changes" : "Save password"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
