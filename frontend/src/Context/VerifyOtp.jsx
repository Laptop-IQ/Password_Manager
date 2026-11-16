import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
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
    <div
      className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center px-4 py-10 sm:px-6"
    >

      

      

      {/* =====================================================
          CARD WRAPPER
      ====================================================== */}

      <section className="relative w-full max-w-[410px]">
        {/* Gradient border */}

        

        {/* =================================================
            CARD
        ================================================== */}

        <div
          className="relative w-full rounded-xl border border-line bg-surface px-6 py-8 shadow-panel sm:px-9 sm:py-9"
        >
          {/* Inner glow */}

          


          

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
              className="icon-btn absolute left-0 top-0"
            >
              <i className="ri-arrow-left-line text-[17px]" aria-hidden="true" />
            </button>

            {/* Icon */}

            <div
              className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary text-white"
            >
              <i className="ri-mail-check-line text-[24px] text-ink" aria-hidden="true" />
            </div>

            {/* Title */}

            <h1
              className="text-2xl font-semibold tracking-tight text-ink"
            >
              Verify Your Account
            </h1>

            <p
              className="mx-auto mt-2 max-w-[310px] px-2 text-[12px] leading-5 text-muted sm:text-[13px]"
            >
              Enter the 6-digit verification code sent to your email
            </p>

            {/* Gradient underline */}

            
          </header>

          {/* =================================================
              EMAIL INFO
          ================================================== */}

          <div
            className="relative z-20 mb-6 flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-line bg-sunken/60 px-3 py-3"
          >
            <i className="ri-mail-check-line text-[16px] shrink-0 text-accent" aria-hidden="true" />

            <p
              className="min-w-0 truncate text-center text-[11px] text-ink-soft sm:text-xs"
              title={email}
            >
              Code sent to{" "}
              <strong className="font-semibold text-ink">
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
              className="relative z-20 mb-5 flex w-full min-w-0 items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-tint px-3 py-2.5 text-xs text-danger"
            >
              <i className="ri-error-warning-line text-[17px] mt-0.5 shrink-0 text-danger" aria-hidden="true" />

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
              className="relative z-20 mb-5 flex w-full min-w-0 items-start gap-2.5 rounded-lg border border-ok/25 bg-ok-tint px-3 py-2.5 text-xs text-ok"
            >
              <i className="ri-checkbox-circle-line text-[17px] mt-0.5 shrink-0 text-ok" aria-hidden="true" />

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
              className="mb-3 block text-center text-[13px] font-semibold text-ink-soft"
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
                  className="field h-12 w-[42px] px-0 text-center text-lg font-semibold"
                />
              ))}
            </div>

            {/* =================================================
                VERIFY BUTTON
            ================================================== */}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary h-11 w-full"
            >
              {/* Button shine */}

              

              {isLoading ? (
                <>
                  <span className="spinner relative z-10" aria-hidden="true" />

                  <span className="relative z-10">Verifying...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Verify OTP</span>

                  <i className="ri-arrow-right-line text-[17px]" aria-hidden="true" />
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
              className="text-[11px] text-muted sm:text-xs"
            >
              Didn't receive the code?
            </span>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || isResending || isLoading}
              className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-accent transition-colors hover:text-accent-hover hover:underline focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:text-faint disabled:no-underline sm:text-xs"
            >
              {isResending ? (
                <>
                  <span className="spinner" aria-hidden="true" />
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
              className="text-[11px] font-medium text-faint transition-colors hover:text-accent focus:outline-none focus:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use a different email
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VerifyOtp;
