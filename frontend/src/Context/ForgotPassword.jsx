import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const USER_API = `${API_BASE}/api/user`;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =========================================================
   FORGOT PASSWORD
========================================================= */

const ForgotPassword = () => {
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState(1);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);

  const otpInputRefs = useRef([]);

  /* =======================================================
     RESEND TIMER
  ======================================================= */

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setResendTimer((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [step, resendTimer]);

  /* =======================================================
     CLEAR MESSAGES
  ======================================================= */

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  /* =======================================================
     EMAIL VALIDATION
  ======================================================= */

  const validateEmail = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email address is required.");
      return false;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (normalizedEmail.length > 254) {
      setError("Email address is too long.");
      return false;
    }

    return true;
  };

  /* =======================================================
     PASSWORD VALIDATION
  ======================================================= */

  const validatePassword = () => {
    if (!newPassword) {
      setError("New password is required.");
      return false;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }

    if (newPassword.length > 128) {
      setError("Password must be less than 128 characters.");
      return false;
    }

    return true;
  };

  /* =======================================================
     OTP VALIDATION
  ======================================================= */

  const validateOtp = () => {
    const otpString = otp.join("");

    if (otpString.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");

      const firstEmptyIndex = otp.findIndex((digit) => !digit);

      otpInputRefs.current[firstEmptyIndex >= 0 ? firstEmptyIndex : 0]?.focus();

      return false;
    }

    return true;
  };

  /* =======================================================
     SEND OTP
  ======================================================= */

  const handleSendOTP = async (event) => {
    event?.preventDefault();

    if (isLoading) {
      return;
    }

    clearMessages();

    if (!validateEmail()) {
      return;
    }

    if (!API_BASE) {
      setError("API configuration is missing. Please contact support.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${USER_API}/forgot-password`,
        {
          email: normalizedEmail,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15000,
        },
      );

      const data = response?.data || {};

      setEmail(normalizedEmail);
      setOtp(Array(OTP_LENGTH).fill(""));
      setMessage(data.message || "OTP has been sent to your email.");

      setStep(2);
      setResendTimer(RESEND_SECONDS);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error("[ForgotPassword Send OTP]", err?.response || err);

      const status = err?.response?.status;

      const responseData = err?.response?.data;

      if (status === 400) {
        setError(
          responseData?.message || "Please enter a valid email address.",
        );
      } else if (status === 404) {
        setError(
          responseData?.message ||
            "No account was found with this email address.",
        );
      } else if (status === 429) {
        setError(
          responseData?.message ||
            "Too many requests. Please wait before trying again.",
        );
      } else if (status >= 500) {
        setError("Server error. Please try again in a few moments.");
      } else if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
        setError("Request timed out. Please try again.");
      } else if (!err?.response) {
        setError(
          "Unable to connect to server. Please check your internet connection.",
        );
      } else {
        setError(
          responseData?.message || "Failed to send OTP. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================================================
     OTP CHANGE
  ======================================================= */

  const handleOtpChange = (event, index) => {
    const rawValue = event.target.value;

    const value = rawValue.replace(/\D/g, "");

    if (!value) {
      setOtp((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });

      setError("");
      return;
    }

    /*
      Support multi-digit paste/input.
    */

    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH - index);

      setOtp((previous) => {
        const next = [...previous];

        digits.split("").forEach((digit, offset) => {
          next[index + offset] = digit;
        });

        return next;
      });

      setError("");

      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);

      otpInputRefs.current[nextIndex]?.focus();

      return;
    }

    setOtp((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });

    setError("");

    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  /* =======================================================
     OTP KEYBOARD
  ======================================================= */

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace") {
      if (otp[index]) {
        setOtp((previous) => {
          const next = [...previous];
          next[index] = "";
          return next;
        });

        return;
      }

      if (index > 0) {
        setOtp((previous) => {
          const next = [...previous];
          next[index - 1] = "";
          return next;
        });

        otpInputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  /* =======================================================
     OTP PASTE
  ======================================================= */

  const handleOtpPaste = (event, index) => {
    event.preventDefault();

    const pastedValue =
      event.clipboardData
        ?.getData("text")
        ?.replace(/\D/g, "")
        ?.slice(0, OTP_LENGTH) || "";

    if (!pastedValue) {
      return;
    }

    setOtp((previous) => {
      const next = [...previous];

      pastedValue
        .slice(0, OTP_LENGTH - index)
        .split("")
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });

      return next;
    });

    setError("");

    const nextIndex = Math.min(index + pastedValue.length, OTP_LENGTH - 1);

    otpInputRefs.current[nextIndex]?.focus();
  };

  /* =======================================================
     VERIFY OTP + RESET PASSWORD
  ======================================================= */

  const handleVerifyOTP = async (event) => {
    event?.preventDefault();

    if (isLoading) {
      return;
    }

    clearMessages();

    if (!validateOtp()) {
      return;
    }

    if (!validatePassword()) {
      return;
    }

    if (!email) {
      setError("Email address is missing. Please start again.");
      return;
    }

    if (!API_BASE) {
      setError("API configuration is missing. Please contact support.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpString = otp.join("");

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${USER_API}/verify-forgot-otp`,
        {
          email: normalizedEmail,
          otp: otpString,
          newPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15000,
        },
      );

      const data = response?.data || {};

      setMessage(data.message || "Password reset successfully.");

      setOtp(Array(OTP_LENGTH).fill(""));
      setNewPassword("");

      /*
        Give user a moment to see success state,
        then redirect to login.
      */

      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1200);
    } catch (err) {
      console.error("[ForgotPassword Verify OTP]", err?.response || err);

      const status = err?.response?.status;

      const responseData = err?.response?.data;

      if (status === 400) {
        setError(
          responseData?.message ||
            "Invalid request. Please check your details.",
        );
      } else if (status === 401) {
        setError(responseData?.message || "Invalid or expired OTP.");
      } else if (status === 404) {
        setError(responseData?.message || "Verification request not found.");
      } else if (status === 429) {
        setError(
          responseData?.message || "Too many attempts. Please try again later.",
        );
      } else if (status >= 500) {
        setError("Server error. Please try again in a few moments.");
      } else if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
        setError("Request timed out. Please try again.");
      } else if (!err?.response) {
        setError(
          "Unable to connect to server. Please check your internet connection.",
        );
      } else {
        setError(
          responseData?.message || "OTP verification failed. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================================================
     RESEND OTP
  ======================================================= */

  const handleResendOTP = async () => {
    if (isResending || isLoading || resendTimer > 0) {
      return;
    }

    clearMessages();

    if (!email) {
      setError("Email address is missing. Please start again.");
      return;
    }

    if (!API_BASE) {
      setError("API configuration is missing. Please contact support.");
      return;
    }

    setIsResending(true);

    try {
      const response = await axios.post(
        `${USER_API}/forgot-password`,
        {
          email: email.trim().toLowerCase(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15000,
        },
      );

      const data = response?.data || {};

      setOtp(Array(OTP_LENGTH).fill(""));
      setNewPassword("");

      setMessage(data.message || "A new OTP has been sent.");

      setResendTimer(RESEND_SECONDS);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error("[ForgotPassword Resend OTP]", err?.response || err);

      const status = err?.response?.status;

      if (status === 429) {
        setError(
          err?.response?.data?.message ||
            "Too many requests. Please wait before trying again.",
        );
      } else if (!err?.response) {
        setError("Unable to connect to server. Please check your connection.");
      } else {
        setError(
          err?.response?.data?.message ||
            "Failed to resend OTP. Please try again.",
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    if (isLoading || isResending) {
      return;
    }

    if (step === 2) {
      setStep(1);
      setOtp(Array(OTP_LENGTH).fill(""));
      setNewPassword("");
      clearMessages();

      return;
    }

    navigate("/login");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main
      className="
        relative
        flex
        min-h-[100dvh]
        w-full
        items-center
        justify-center
        overflow-hidden
        bg-gradient-to-br
        from-[#f8f7ff]
        via-white
        to-[#f3f0ff]
        px-4
        py-6
        sm:px-6
        sm:py-8
      "
    >
      {/* =====================================================
          BACKGROUND GLOW
      ====================================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-28
          -top-28
          h-72
          w-72
          rounded-full
          bg-purple-300/20
          blur-3xl
          sm:-right-36
          sm:-top-36
          sm:h-96
          sm:w-96
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -bottom-28
          -left-28
          h-72
          w-72
          rounded-full
          bg-blue-300/15
          blur-3xl
          sm:-bottom-36
          sm:-left-36
          sm:h-96
          sm:w-96
        "
      />

      {/* =====================================================
          CARD
      ====================================================== */}

      <section className="relative w-full max-w-[410px]">
        {/* Gradient border */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            -inset-[1px]
            rounded-[25px]
            bg-gradient-to-r
            from-[#7c3aed]
            via-[#c026d3]
            to-[#3b82f6]
            opacity-75
          "
        />

        <div
          className="
            relative
            w-full
            overflow-hidden
            rounded-[24px]
            border
            border-white
            bg-white
            px-6
            py-7
            shadow-[0_20px_55px_rgba(76,29,149,0.14)]
            sm:px-9
            sm:py-8
          "
        >
          {/* =================================================
              INNER GLOW
          ================================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -right-20
              -top-20
              h-44
              w-44
              rounded-full
              bg-purple-200/15
              blur-3xl
            "
          />

          {/* =================================================
              DOT PATTERN
          ================================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              right-5
              top-5
              z-10
              grid
              grid-cols-5
              gap-[4px]
              opacity-25
            "
          >
            {Array.from({
              length: 25,
            }).map((_, index) => (
              <span
                key={index}
                className="
                  block
                  h-[2px]
                  w-[2px]
                  rounded-full
                  bg-[#7c3aed]
                "
              />
            ))}
          </div>

          {/* =================================================
              HEADER
          ================================================== */}

          <header
            className="
              relative
              z-20
              mb-7
              text-center
            "
          >
            {/* Back */}

            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading || isResending}
              aria-label="Go back"
              className="
                absolute
                left-0
                top-0
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-gray-400
                transition-all
                duration-200
                hover:bg-purple-50
                hover:text-purple-600
                focus:outline-none
                focus:ring-2
                focus:ring-purple-500/30
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>

            {/* Icon */}

            <div
              className="
                mx-auto
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-[14px]
                bg-gradient-to-br
                from-[#7c3aed]
                to-[#3b82f6]
                shadow-lg
                shadow-purple-500/20
              "
            >
              {step === 1 ? (
                <KeyRound size={24} className="text-white" aria-hidden="true" />
              ) : (
                <Lock size={23} className="text-white" aria-hidden="true" />
              )}
            </div>

            {/* Title */}

            <h1
              className="
                whitespace-nowrap
                px-7
                text-[27px]
                font-extrabold
                leading-tight
                tracking-[-0.03em]
                text-transparent
                bg-gradient-to-r
                from-[#7c3aed]
                via-[#c026d3]
                to-[#3b82f6]
                bg-clip-text
                sm:text-[30px]
              "
            >
              {step === 1 ? "Forgot Password" : "Reset Password"}
            </h1>

            <p
              className="
                mx-auto
                mt-2
                max-w-[310px]
                px-2
                text-[12px]
                leading-5
                text-gray-500
                sm:text-[13px]
              "
            >
              {step === 1
                ? "Enter your email to receive a verification code"
                : "Enter the OTP and choose a new password"}
            </p>

            {/* Underline */}

            <div
              aria-hidden="true"
              className="
                mx-auto
                mt-3
                h-[3px]
                w-12
                rounded-full
                bg-gradient-to-r
                from-[#7c3aed]
                to-[#3b82f6]
              "
            />
          </header>

          {/* =================================================
              SUCCESS MESSAGE
          ================================================== */}

          {message && (
            <div
              role="status"
              aria-live="polite"
              className="
                relative
                z-20
                mb-5
                flex
                w-full
                min-w-0
                items-start
                gap-2.5
                rounded-lg
                border
                border-green-200
                bg-green-50
                px-3
                py-2.5
                text-xs
                text-green-600
              "
            >
              <CheckCircle2
                size={17}
                className="
                  mt-0.5
                  shrink-0
                  text-green-500
                "
                aria-hidden="true"
              />

              <span className="min-w-0 break-words leading-5">{message}</span>
            </div>
          )}

          {/* =================================================
              ERROR MESSAGE
          ================================================== */}

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="
                relative
                z-20
                mb-5
                flex
                w-full
                min-w-0
                items-start
                gap-2.5
                rounded-lg
                border
                border-red-200
                bg-red-50
                px-3
                py-2.5
                text-xs
                text-red-600
              "
            >
              <AlertCircle
                size={17}
                className="
                  mt-0.5
                  shrink-0
                  text-red-500
                "
                aria-hidden="true"
              />

              <span className="min-w-0 break-words leading-5">{error}</span>
            </div>
          )}

          {/* =================================================
              STEP 1 — EMAIL
          ================================================== */}

          {step === 1 && (
            <form
              onSubmit={handleSendOTP}
              noValidate
              className="
                relative
                z-20
                w-full
              "
            >
              <div className="mb-5 w-full">
                <label
                  htmlFor="forgot-email"
                  className="
                    mb-2
                    block
                    text-[13px]
                    font-semibold
                    text-gray-700
                  "
                >
                  Email Address
                </label>

                <div className="group relative w-full">
                  <Mail
                    size={18}
                    className="
                      pointer-events-none
                      absolute
                      left-3.5
                      top-1/2
                      z-10
                      -translate-y-1/2
                      text-gray-400
                      transition-colors
                      group-focus-within:text-purple-500
                    "
                    aria-hidden="true"
                  />

                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                      setMessage("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={254}
                    required
                    disabled={isLoading}
                    className="
                      box-border
                      block
                      h-[48px]
                      w-full
                      min-w-0
                      rounded-[10px]
                      border
                      border-gray-200
                      bg-white
                      px-10
                      pr-3
                      text-[13px]
                      text-gray-800
                      outline-none
                      transition-all
                      duration-200
                      placeholder:text-gray-400
                      hover:border-purple-200
                      focus:border-purple-500
                      focus:ring-4
                      focus:ring-purple-500/10
                      disabled:cursor-not-allowed
                      disabled:bg-gray-50
                      disabled:opacity-70
                    "
                  />
                </div>
              </div>

              {/* Send OTP */}

              <button
                type="submit"
                disabled={isLoading}
                className="
                  group
                  relative
                  flex
                  h-[48px]
                  w-full
                  items-center
                  justify-center
                  gap-2
                  overflow-hidden
                  rounded-[10px]
                  bg-gradient-to-r
                  from-[#7c3aed]
                  via-[#c026d3]
                  to-[#3b82f6]
                  px-4
                  text-[13px]
                  font-bold
                  text-white
                  shadow-md
                  shadow-purple-500/20
                  transition-all
                  duration-300
                  hover:-translate-y-[1px]
                  hover:shadow-lg
                  hover:shadow-purple-500/25
                  focus:outline-none
                  focus:ring-4
                  focus:ring-purple-500/20
                  disabled:cursor-not-allowed
                  disabled:translate-y-0
                  disabled:opacity-60
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    absolute
                    inset-0
                    -translate-x-full
                    bg-gradient-to-r
                    from-transparent
                    via-white/20
                    to-transparent
                    transition-transform
                    duration-700
                    group-hover:translate-x-full
                  "
                />

                {isLoading ? (
                  <>
                    <Loader2
                      size={17}
                      className="
                        relative
                        z-10
                        animate-spin
                      "
                      aria-hidden="true"
                    />

                    <span className="relative z-10">Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span className="relative z-10">Send OTP</span>

                    <ArrowRight
                      size={17}
                      className="
                        relative
                        z-10
                        transition-transform
                        duration-300
                        group-hover:translate-x-1
                      "
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>

              {/* Login */}

              <div className="mt-5 text-center">
                <p className="text-xs text-gray-500">
                  Remember your password?{" "}
                  <Link
                    to="/login"
                    className="
                      font-bold
                      text-purple-600
                      hover:text-blue-600
                      hover:underline
                    "
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* =================================================
              STEP 2 — OTP + NEW PASSWORD
          ================================================== */}

          {step === 2 && (
            <form
              onSubmit={handleVerifyOTP}
              noValidate
              className="
                relative
                z-20
                w-full
              "
            >
              {/* Email info */}

              <div
                className="
                  mb-5
                  flex
                  w-full
                  min-w-0
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-purple-100
                  bg-purple-50/60
                  px-3
                  py-3
                "
              >
                <Mail
                  size={16}
                  className="
                    shrink-0
                    text-purple-500
                  "
                  aria-hidden="true"
                />

                <p
                  className="
                    min-w-0
                    truncate
                    text-center
                    text-[11px]
                    text-gray-600
                  "
                  title={email}
                >
                  Code sent to{" "}
                  <strong className="font-semibold text-gray-800">
                    {email}
                  </strong>
                </p>
              </div>

              {/* OTP Label */}

              <label
                className="
                  mb-3
                  block
                  text-center
                  text-[13px]
                  font-semibold
                  text-gray-700
                "
              >
                Verification Code
              </label>

              {/* OTP Boxes */}

              <div
                className="
                  mb-5
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-1.5
                  sm:gap-2.5
                "
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpInputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    disabled={isLoading}
                    aria-label={`OTP digit ${index + 1}`}
                    onChange={(event) => handleOtpChange(event, index)}
                    onKeyDown={(event) => handleOtpKeyDown(event, index)}
                    onPaste={(event) => handleOtpPaste(event, index)}
                    className="
                        box-border
                        h-[46px]
                        w-[40px]
                        min-w-0
                        rounded-[10px]
                        border
                        border-gray-200
                        bg-white
                        text-center
                        text-[18px]
                        font-bold
                        text-gray-800
                        outline-none
                        transition-all
                        duration-200
                        hover:border-purple-200
                        focus:border-purple-500
                        focus:ring-4
                        focus:ring-purple-500/10
                        disabled:cursor-not-allowed
                        disabled:bg-gray-50
                        disabled:opacity-60
                        sm:h-[50px]
                        sm:w-[44px]
                      "
                  />
                ))}
              </div>

              {/* Resend */}

              <div
                className="
                  mb-5
                  flex
                  flex-wrap
                  items-center
                  justify-center
                  gap-1.5
                  text-center
                "
              >
                <span className="text-[11px] text-gray-500">
                  Didn't receive the code?
                </span>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendTimer > 0 || isResending || isLoading}
                  className="
                    rounded
                    text-[11px]
                    font-bold
                    text-purple-600
                    transition-colors
                    hover:text-blue-600
                    hover:underline
                    focus:outline-none
                    disabled:cursor-not-allowed
                    disabled:text-gray-400
                    disabled:no-underline
                  "
                >
                  {isResending ? (
                    <>Sending...</>
                  ) : resendTimer > 0 ? (
                    <>Resend in {resendTimer}s</>
                  ) : (
                    "Resend OTP"
                  )}
                </button>
              </div>

              {/* New Password */}

              <div className="mb-5 w-full">
                <label
                  htmlFor="new-password"
                  className="
                    mb-2
                    block
                    text-[13px]
                    font-semibold
                    text-gray-700
                  "
                >
                  New Password
                </label>

                <div className="group relative w-full">
                  <Lock
                    size={18}
                    className="
                      pointer-events-none
                      absolute
                      left-3.5
                      top-1/2
                      z-10
                      -translate-y-1/2
                      text-gray-400
                      transition-colors
                      group-focus-within:text-purple-500
                    "
                    aria-hidden="true"
                  />

                  <input
                    id="new-password"
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    maxLength={128}
                    required
                    disabled={isLoading}
                    className="
                      box-border
                      block
                      h-[48px]
                      w-full
                      min-w-0
                      rounded-[10px]
                      border
                      border-gray-200
                      bg-white
                      px-10
                      pr-12
                      text-[13px]
                      text-gray-800
                      outline-none
                      transition-all
                      duration-200
                      placeholder:text-gray-400
                      hover:border-purple-200
                      focus:border-purple-500
                      focus:ring-4
                      focus:ring-purple-500/10
                      disabled:cursor-not-allowed
                      disabled:bg-gray-50
                      disabled:opacity-70
                    "
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    disabled={isLoading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="
                      absolute
                      right-1.5
                      top-1/2
                      z-20
                      flex
                      h-9
                      w-9
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-lg
                      text-gray-400
                      transition-colors
                      hover:bg-purple-50
                      hover:text-purple-600
                      focus:outline-none
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {showPassword ? (
                      <EyeOff size={17} aria-hidden="true" />
                    ) : (
                      <Eye size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Minimum 6 characters
                </p>
              </div>

              {/* Reset Button */}

              <button
                type="submit"
                disabled={isLoading}
                className="
                  group
                  relative
                  flex
                  h-[48px]
                  w-full
                  items-center
                  justify-center
                  gap-2
                  overflow-hidden
                  rounded-[10px]
                  bg-gradient-to-r
                  from-[#7c3aed]
                  via-[#c026d3]
                  to-[#3b82f6]
                  px-4
                  text-[13px]
                  font-bold
                  text-white
                  shadow-md
                  shadow-purple-500/20
                  transition-all
                  duration-300
                  hover:-translate-y-[1px]
                  hover:shadow-lg
                  hover:shadow-purple-500/25
                  focus:outline-none
                  focus:ring-4
                  focus:ring-purple-500/20
                  disabled:cursor-not-allowed
                  disabled:translate-y-0
                  disabled:opacity-60
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    absolute
                    inset-0
                    -translate-x-full
                    bg-gradient-to-r
                    from-transparent
                    via-white/20
                    to-transparent
                    transition-transform
                    duration-700
                    group-hover:translate-x-full
                  "
                />

                {isLoading ? (
                  <>
                    <Loader2
                      size={17}
                      className="
                        relative
                        z-10
                        animate-spin
                      "
                      aria-hidden="true"
                    />

                    <span className="relative z-10">Resetting...</span>
                  </>
                ) : (
                  <>
                    <span className="relative z-10">Reset Password</span>

                    <ArrowRight
                      size={17}
                      className="
                        relative
                        z-10
                        transition-transform
                        duration-300
                        group-hover:translate-x-1
                      "
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>

              {/* Back */}

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading || isResending}
                  className="
                    text-[11px]
                    font-medium
                    text-gray-400
                    transition-colors
                    hover:text-purple-600
                    hover:underline
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  ← Use a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default ForgotPassword;
