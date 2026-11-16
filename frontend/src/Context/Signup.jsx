import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =========================================================
   SIGNUP COMPONENT
========================================================= */

const Signup = () => {
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  /* =======================================================
     RESTORE REMEMBERED EMAIL
  ======================================================= */

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("rememberedEmail");

      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (storageError) {
      console.warn("[Signup] Unable to read localStorage.", storageError);
    }
  }, []);

  /* =======================================================
     CLEAR FIELD ERROR
  ======================================================= */

  const clearFieldError = (field) => {
    setErrors((previous) => {
      if (!previous[field] && !previous.api) {
        return previous;
      }

      const next = { ...previous };

      delete next[field];

      if (field !== "api") {
        delete next.api;
      }

      return next;
    });
  };

  /* =======================================================
     INPUT HANDLERS
  ======================================================= */

  const handleNameChange = (event) => {
    setName(event.target.value);
    clearFieldError("name");
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
    clearFieldError("email");
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    clearFieldError("password");
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validateForm = () => {
    const newErrors = {};

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      newErrors.name = "Full name is required.";
    } else if (normalizedName.length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    } else if (normalizedName.length > 80) {
      newErrors.name = "Name must be less than 80 characters.";
    }

    if (!normalizedEmail) {
      newErrors.email = "Email address is required.";
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      newErrors.email = "Please enter a valid email address.";
    } else if (normalizedEmail.length > 254) {
      newErrors.email = "Email address is too long.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    } else if (password.length > 128) {
      newErrors.password = "Password must be less than 128 characters.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  /* =======================================================
     SIGNUP REQUEST
  ======================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (!API_BASE) {
      setErrors({
        api: "API configuration is missing. Please contact support.",
      });
      return;
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    setIsLoading(true);
    setErrors({});

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const response = await axios.post(
        `${USER_API}/register`,
        {
          name: normalizedName,
          email: normalizedEmail,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: controller.signal,
          timeout: 15000,
        },
      );

      const data = response?.data || {};

      /* -----------------------------------------------
         Remember email only.
         Never store password.
      ------------------------------------------------ */

      try {
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", normalizedEmail);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
      } catch (storageError) {
        console.warn("[Signup] Unable to save remembered email.", storageError);
      }

      /* -----------------------------------------------
         Clear sensitive password state
      ------------------------------------------------ */

      setPassword("");
      setShowPassword(false);

      /* -----------------------------------------------
         Navigate to OTP verification
      ------------------------------------------------ */

      navigate("/verify-otp", {
        replace: true,
        state: {
          email: normalizedEmail,
          name: normalizedName,
          registrationResponse: data,
        },
      });
    } catch (err) {
      console.error("[Signup]", err?.response || err);

      const status = err?.response?.status;
      const responseData = err?.response?.data;

      /* -----------------------------------------------
         Backend validation errors
      ------------------------------------------------ */

      if (responseData?.errors) {
        const backendErrors = responseData.errors;

        if (
          typeof backendErrors === "object" &&
          !Array.isArray(backendErrors)
        ) {
          setErrors(backendErrors);
        } else if (Array.isArray(backendErrors)) {
          setErrors({
            api: backendErrors.join(" "),
          });
        } else {
          setErrors({
            api: String(backendErrors),
          });
        }

        return;
      }

      /* -----------------------------------------------
         Common HTTP errors
      ------------------------------------------------ */

      if (status === 400) {
        setErrors({
          api:
            responseData?.message || "Please check your registration details.",
        });
        return;
      }

      if (status === 409) {
        setErrors({
          email:
            responseData?.message ||
            "An account with this email already exists.",
        });
        return;
      }

      if (status === 422) {
        setErrors({
          api:
            responseData?.message ||
            "Please check the information you entered.",
        });
        return;
      }

      if (status === 429) {
        setErrors({
          api: "Too many registration attempts. Please try again later.",
        });
        return;
      }

      if (status >= 500) {
        setErrors({
          api: "Server error. Please try again in a few moments.",
        });
        return;
      }

      /* -----------------------------------------------
         Timeout / cancelled request
      ------------------------------------------------ */

      if (
        err?.code === "ECONNABORTED" ||
        err?.code === "ETIMEDOUT" ||
        err?.name === "CanceledError" ||
        err?.name === "AbortError"
      ) {
        setErrors({
          api: "Request timed out. Please check your connection and try again.",
        });
        return;
      }

      /* -----------------------------------------------
         Network error
      ------------------------------------------------ */

      if (!err?.response) {
        setErrors({
          api: "Unable to connect to server. Please check your internet connection.",
        });
        return;
      }

      /* -----------------------------------------------
         Fallback
      ------------------------------------------------ */

      setErrors({
        api:
          responseData?.message ||
          err?.message ||
          "Unable to create account. Please try again.",
      });
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  /* =======================================================
     UI
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

          


          

          {/* =================================================
              HEADER
          ================================================== */}

          <header
            className="
              relative
              z-20
              mb-6
              text-center
              sm:mb-7
            "
          >
            {/* Back button */}

            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isLoading}
              aria-label="Go back"
              className="icon-btn absolute left-0 top-0"
            >
              <i className="ri-arrow-left-line text-[17px]" aria-hidden="true" />
            </button>

            {/* Heading */}

            <h1
              className="text-2xl font-semibold tracking-tight text-ink"
            >
              Create Account
            </h1>

            <p
              className="mt-2 px-4 text-[12px] font-normal leading-5 text-muted sm:text-[13px]"
            >
              Join ExpenseTracker to manage your finances
            </p>

            {/* Gradient underline */}

            
          </header>

          {/* =================================================
              API ERROR
          ================================================== */}

          {errors.api && (
            <div
              role="alert"
              aria-live="polite"
              className="relative z-20 mb-5 flex w-full min-w-0 items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-tint px-3 py-2.5 text-xs text-danger"
            >
              <i className="ri-error-warning-line text-[17px] mt-0.5 shrink-0 text-danger" aria-hidden="true" />

              <span className="min-w-0 break-words leading-5">
                {errors.api}
              </span>
            </div>
          )}

          {/* =================================================
              FORM
          ================================================== */}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative z-20 w-full"
          >
            {/* =================================================
                FULL NAME
            ================================================== */}

            <div className="mb-4 w-full">
              <label
                htmlFor="name"
                className="mb-2 block text-[13px] font-semibold text-ink-soft"
              >
                Full Name
              </label>

              <div className="group relative w-full">
                <i className="ri-user-line text-[18px] pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-faint transition-colors group-focus-within:text-accent" aria-hidden="true" />

                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="John Doe"
                  autoComplete="name"
                  autoCapitalize="words"
                  maxLength={80}
                  required
                  disabled={isLoading}
                  className={`
                    field h-11 px-10 pr-3
                    ${
                      errors.name
                        ? "border-danger focus:border-red-400 focus:ring-red-500/10"
                        : "border-line-strong"
                    }
                  
                  `}
                />
              </div>

              {errors.name && (
                <p
                  className="mt-1.5 text-[11px] leading-4 text-danger"
                >
                  {errors.name}
                </p>
              )}
            </div>

            {/* =================================================
                EMAIL
            ================================================== */}

            <div className="mb-4 w-full">
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-semibold text-ink-soft"
              >
                Email Address
              </label>

              <div className="group relative w-full">
                <i className="ri-mail-line text-[18px] pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-faint transition-colors group-focus-within:text-accent" aria-hidden="true" />

                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={254}
                  required
                  disabled={isLoading}
                  className={`
                    field h-11 px-10 pr-3
                    ${
                      errors.email
                        ? "border-danger focus:border-red-400 focus:ring-red-500/10"
                        : "border-line-strong"
                    }
                  
                  `}
                />
              </div>

              {errors.email && (
                <p
                  className="mt-1.5 text-[11px] leading-4 text-danger"
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* =================================================
                PASSWORD
            ================================================== */}

            <div className="mb-4 w-full">
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-semibold text-ink-soft"
              >
                Password
              </label>

              <div className="group relative w-full">
                <i className="ri-lock-line text-[18px] pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-faint transition-colors group-focus-within:text-accent" aria-hidden="true" />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  disabled={isLoading}
                  className={`
                    field h-11 px-10 pr-12
                    ${
                      errors.password
                        ? "border-danger focus:border-red-400 focus:ring-red-500/10"
                        : "border-line-strong"
                    }
                  
                  `}
                />

                {/* Password toggle */}

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="icon-btn absolute right-1.5 top-1/2 z-20 h-9 w-9 -translate-y-1/2"
                >
                  {showPassword ? (
                    <i className="ri-eye-off-line text-[17px]" aria-hidden="true" />
                  ) : (
                    <i className="ri-eye-line text-[17px]" aria-hidden="true" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p
                  className="mt-1.5 text-[11px] leading-4 text-danger"
                >
                  {errors.password}
                </p>
              )}
            </div>

            {/* =================================================
                REMEMBER ME
            ================================================== */}

            <div className="mb-5 flex items-center">
              <input
                type="checkbox"
                id="remember"
                name="remember"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-primary focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed"
              />

              <label
                htmlFor="remember"
                className="ml-2 cursor-pointer select-none text-[11px] text-muted"
              >
                Remember me
              </label>
            </div>

            {/* =================================================
                CREATE ACCOUNT BUTTON
            ================================================== */}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary h-11 w-full"
            >

              

              {isLoading ? (
                <>
                  <span className="spinner relative z-10" aria-hidden="true" />

                  <span className="relative z-10">Creating account...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Create Account</span>

                  <i className="ri-arrow-right-line text-[17px]" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* =================================================
              DIVIDER
          ================================================== */}

          <div className="my-5 flex w-full items-center gap-3">
            <div className="h-px min-w-0 flex-1 bg-sunken" />

            <span
              className="shrink-0 text-[10px] font-medium text-faint"
            >
              OR
            </span>

            <div className="h-px min-w-0 flex-1 bg-sunken" />
          </div>

          {/* =================================================
              SIGN IN
          ================================================== */}

          <div className="relative z-20 w-full text-center">
            <p className="text-xs text-muted sm:text-[13px]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="rounded font-medium text-accent transition-colors hover:text-accent-hover hover:underline focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* =================================================
              ANTI-PHISHING TRUST NOTE
          ================================================== */}

          <p className="relative z-20 mt-5 text-center text-[11px] leading-relaxed text-faint">
            Always check the address bar before creating your account. We
            will never email, call, or text you asking for your password.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Signup;
