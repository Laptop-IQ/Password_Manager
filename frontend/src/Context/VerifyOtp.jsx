import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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

/* =========================================================
   VERIFY OTP
========================================================= */

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  /* =======================================================
     STATE
  ======================================================= */

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));

  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");

  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);

  const [isLoading, setIsLoading] = useState(false);

  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef([]);

  /* =======================================================
     REDIRECT IF EMAIL IS MISSING
  ======================================================= */

  useEffect(() => {
    if (!email) {
      navigate("/signup", { replace: true });
    }
  }, [email, navigate]);

  /* =======================================================
     AUTO FOCUS FIRST OTP INPUT
  ======================================================= */

  useEffect(() => {
    if (email) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [email]);

  /* =======================================================
     RESEND COUNTDOWN
  ======================================================= */

  useEffect(() => {
    if (resendTimer <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setResendTimer((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [resendTimer]);

  /* =======================================================
     MASK EMAIL
  ======================================================= */

  const maskedEmail = (() => {
    if (!email || !email.includes("@")) {
      return email;
    }

    const [username, domain] = email.split("@");

    if (username.length <= 2) {
      return `${username[0] || ""}***@${domain}`;
    }

    return `${username.slice(0, 2)}***@${domain}`;
  })();

  /* =======================================================
     UPDATE OTP
  ======================================================= */

  const updateOtp = (index, value) => {
    setOtp((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });

    setError("");
    setResendMessage("");
  };

  /* =======================================================
     HANDLE OTP INPUT
  ======================================================= */

  const handleChange = (event, index) => {
    const rawValue = event.target.value;

    /*
      Keep digits only.
    */

    const value = rawValue.replace(/\D/g, "");

    if (!value) {
      updateOtp(index, "");

      return;
    }

    /*
      If user pastes/types multiple digits,
      distribute them across OTP boxes.
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
      setResendMessage("");

      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);

      inputRefs.current[nextIndex]?.focus();

      return;
    }

    updateOtp(index, value);

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /* =======================================================
     HANDLE KEY DOWN
  ======================================================= */

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace") {
      if (otp[index]) {
        updateOtp(index, "");
        return;
      }

      if (index > 0) {
        updateOtp(index - 1, "");
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /* =======================================================
     HANDLE PASTE
  ======================================================= */

  const handlePaste = (event, index) => {
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
    setResendMessage("");

    const focusIndex = Math.min(index + pastedValue.length, OTP_LENGTH - 1);

    inputRefs.current[focusIndex]?.focus();
  };

  /* =======================================================
     VERIFY OTP
  ======================================================= */

  const handleVerify = async (event) => {
    event?.preventDefault();

    if (isLoading) {
      return;
    }

    const otpString = otp.join("");

    if (otpString.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");

      const firstEmptyIndex = otp.findIndex((digit) => !digit);

      inputRefs.current[firstEmptyIndex >= 0 ? firstEmptyIndex : 0]?.focus();

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

    setIsLoading(true);
    setError("");
    setResendMessage("");

    try {
      const response = await axios.post(
        `${USER_API}/verify-signup-otp`,
        {
          email: email.trim().toLowerCase(),
          otp: otpString,
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

      const token = data.token;
      const user = data.user || data.profile;

      /*
        Authentication token is required.
      */

      if (!token) {
        throw new Error(
          "Verification succeeded but authentication token was not returned.",
        );
      }

      /*
        Save authentication data.
      */

      try {
        localStorage.setItem("token", token);

        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch (storageError) {
        console.error("[VerifyOtp] Storage error:", storageError);

        setError(
          "Verification succeeded, but your session could not be saved. Please try again.",
        );

        return;
      }

      /*
        Clear OTP from state before redirect.
      */

      setOtp(Array(OTP_LENGTH).fill(""));

      /*
        Redirect to dashboard/home.
      */

      navigate("/", {
        replace: true,
      });
    } catch (err) {
      console.error("[VerifyOtp]", err?.response || err);

      const status = err?.response?.status;

      const responseData = err?.response?.data;

      if (status === 400) {
        setError(
          responseData?.message ||
            "Invalid OTP. Please check the code and try again.",
        );
        return;
      }

      if (status === 401) {
        setError(responseData?.message || "The OTP is invalid or has expired.");
        return;
      }

      if (status === 404) {
        setError(
          responseData?.message ||
            "Verification request not found. Please request a new OTP.",
        );
        return;
      }

      if (status === 429) {
        setError("Too many attempts. Please wait and try again.");
        return;
      }

      if (status >= 500) {
        setError("Server error. Please try again in a few moments.");
        return;
      }

      if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
        setError(
          "Request timed out. Please check your connection and try again.",
        );
        return;
      }

      if (!err?.response) {
        setError(
          "Unable to connect to server. Please check your internet connection.",
        );
        return;
      }

      setError(
        responseData?.message ||
          err?.message ||
          "OTP verification failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================================================
     RESEND OTP
  ======================================================= */

  const handleResend = async () => {
    if (isResending || isLoading || resendTimer > 0) {
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

    setIsResending(true);
    setError("");
    setResendMessage("");

    try {
      await axios.post(
        `${USER_API}/resend-signup-otp`,
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

      setOtp(Array(OTP_LENGTH).fill(""));
      setResendTimer(RESEND_SECONDS);

      setResendMessage("A new OTP has been sent to your email.");

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error("[VerifyOtp Resend]", err?.response || err);

      const status = err?.response?.status;

      const message = err?.response?.data?.message;

      if (status === 429) {
        setError(
          message ||
            "Too many requests. Please wait before requesting another OTP.",
        );
      } else if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
        setError("Request timed out. Please try again.");
      } else if (!err?.response) {
        setError(
          "Unable to connect to server. Please check your internet connection.",
        );
      } else {
        setError(message || "Failed to resend OTP. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  };

  /* =======================================================
     GO BACK
  ======================================================= */

  const handleBack = () => {
    if (isLoading || isResending) {
      return;
    }

    navigate("/signup");
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
          CARD WRAPPER
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

        {/* =================================================
            CARD
        ================================================== */}

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
          {/* Inner glow */}

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
              SMALL DOT PATTERN
              
              IMPORTANT:
              Dots are INSIDE card and positioned
              away from heading.
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
            {/* Back button */}

            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading || isResending}
              aria-label="Back to signup"
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
              <MailCheck size={24} className="text-white" aria-hidden="true" />
            </div>

            {/* Title */}

            <h1
              className="
                whitespace-nowrap
                px-7
                text-[26px]
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
              Verify Your Account
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
              Enter the 6-digit verification code sent to your email
            </p>

            {/* Gradient underline */}

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
              EMAIL INFO
          ================================================== */}

          <div
            className="
              relative
              z-20
              mb-6
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
            <MailCheck
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
                sm:text-xs
              "
              title={email}
            >
              Code sent to{" "}
              <strong className="font-semibold text-gray-800">
                {maskedEmail}
              </strong>
            </p>
          </div>

          {/* =================================================
              ERROR
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
              SUCCESS RESEND MESSAGE
          ================================================== */}

          {resendMessage && (
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

              <span className="min-w-0 break-words leading-5">
                {resendMessage}
              </span>
            </div>
          )}

          {/* =================================================
              FORM
          ================================================== */}

          <form
            onSubmit={handleVerify}
            className="relative z-20 w-full"
            noValidate
          >
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

            {/* =================================================
                OTP INPUTS
            ================================================== */}

            <div
              className="
                mb-6
                flex
                w-full
                items-center
                justify-center
                gap-1.5
                xs:gap-2
                sm:gap-2.5
              "
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  disabled={isLoading}
                  aria-label={`OTP digit ${index + 1}`}
                  onChange={(event) => handleChange(event, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  onPaste={(event) => handlePaste(event, index)}
                  className="
                    box-border
                    h-[48px]
                    w-[42px]
                    min-w-0
                    rounded-[10px]
                    border
                    border-gray-200
                    bg-white
                    text-center
                    text-[19px]
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
                    sm:h-[52px]
                    sm:w-[46px]
                    sm:rounded-xl
                  "
                />
              ))}
            </div>

            {/* =================================================
                VERIFY BUTTON
            ================================================== */}

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
              {/* Button shine */}

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

                  <span className="relative z-10">Verifying...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Verify OTP</span>

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
          </form>

          {/* =================================================
              RESEND
          ================================================== */}

          <div
            className="
              relative
              z-20
              mt-5
              flex
              flex-wrap
              items-center
              justify-center
              gap-1.5
              text-center
            "
          >
            <span
              className="
                text-[11px]
                text-gray-500
                sm:text-xs
              "
            >
              Didn't receive the code?
            </span>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || isResending || isLoading}
              className="
                inline-flex
                items-center
                gap-1
                rounded
                text-[11px]
                font-bold
                text-purple-600
                transition-colors
                hover:text-blue-600
                hover:underline
                focus:outline-none
                focus:ring-2
                focus:ring-purple-500/30
                disabled:cursor-not-allowed
                disabled:text-gray-400
                disabled:no-underline
                sm:text-xs
              "
            >
              {isResending ? (
                <>
                  <Loader2
                    size={12}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Sending...
                </>
              ) : resendTimer > 0 ? (
                <>Resend in {resendTimer}s</>
              ) : (
                "Resend OTP"
              )}
            </button>
          </div>

          {/* =================================================
              CHANGE EMAIL
          ================================================== */}

          <div
            className="
              relative
              z-20
              mt-4
              text-center
            "
          >
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
                focus:outline-none
                focus:underline
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              ← Use a different email
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default VerifyOtp;
