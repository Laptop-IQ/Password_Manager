import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

/* =========================================================
   API CONFIG
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
   LOGIN
========================================================= */

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  /* =======================================================
     STATE
  ======================================================= */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /* =======================================================
     SAFE REDIRECT
  ======================================================= */

  const redirectAfterLogin = useMemo(() => {
    const from = location.state?.from;

    if (typeof from === "string" && from.startsWith("/")) {
      return from;
    }

    if (from && typeof from === "object" && typeof from.pathname === "string") {
      return `${from.pathname}${from.search || ""}${from.hash || ""}`;
    }

    return "/";
  }, [location.state]);

  /* =======================================================
     REMEMBERED EMAIL
  ======================================================= */

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("rememberedEmail");

      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.warn("[Login] Unable to read localStorage.", error);
    }
  }, []);

  /* =======================================================
     INPUT HANDLERS
  ======================================================= */

  const handleEmailChange = (event) => {
    setEmail(event.target.value);

    if (error) {
      setError("");
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);

    if (error) {
      setError("");
    }
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validateForm = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email address is required.");
      return false;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (!password) {
      setError("Password is required.");
      return false;
    }

    return true;
  };

  /* =======================================================
     LOGIN REQUEST
  ======================================================= */

  const handleSubmit = async (event) => {
    if (twoFactorRequired) {
      return handleVerify2FA(event);
    }
    event.preventDefault();

    if (isLoading) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!API_BASE) {
      setError("API configuration is missing. Please contact support.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${USER_API}/login`,
        {
          email: normalizedEmail,
          password,
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

      if (data?.twoFactorRequired) {
        setPreAuthToken(data.preAuthToken);
        setTwoFactorRequired(true);
        setIsLoading(false);
        return;
      }

      const token = data?.token;
      const profile = data?.user || data?.profile;

      if (!token) {
        throw new Error(
          "Login succeeded but authentication token was not returned.",
        );
      }

      const userData = profile || {
        email: normalizedEmail,
      };

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
        console.warn("[Login] Unable to save remembered email.", storageError);
      }

      /* -----------------------------------------------
         Parent authentication handler
      ------------------------------------------------ */

      if (typeof onLogin === "function") {
        onLogin(userData, rememberMe, token);
      }

      /* -----------------------------------------------
         Clear password from component state
      ------------------------------------------------ */

      setPassword("");
      setShowPassword(false);

      /* -----------------------------------------------
         Navigate
      ------------------------------------------------ */

      navigate(redirectAfterLogin, {
        replace: true,
      });
    } catch (err) {
      console.error("[Login]", err?.response || err);

      const status = err?.response?.status;

      let message = err?.response?.data?.message || err?.response?.data?.error;

      if (!message && status === 400) {
        message = "Please check your email and password.";
      }

      if (!message && status === 401) {
        message = "Invalid email or password.";
      }

      if (!message && status === 403) {
        message = "Your account does not have permission to sign in.";
      }

      if (!message && status === 404) {
        message = "Login service is currently unavailable.";
      }

      if (!message && status === 429) {
        message = "Too many login attempts. Please try again later.";
      }

      if (!message && status >= 500) {
        message = "Server error. Please try again in a few moments.";
      }

      if (!message && !err?.response) {
        message =
          "Unable to connect to server. Please check your internet connection.";
      }

      setError(
        message || "Login failed. Please check your credentials and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================================================
     2FA VERIFICATION (second login step)
  ======================================================= */

  const handleVerify2FA = async (event) => {
    event.preventDefault();
    if (verifying2FA) return;

    if (!twoFactorCode.trim()) {
      setTwoFactorError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying2FA(true);
    setTwoFactorError("");

    try {
      const response = await axios.post(
        `${USER_API}/login/verify-2fa`,
        { preAuthToken, code: twoFactorCode.trim() },
        { headers: { "Content-Type": "application/json" }, timeout: 15000 },
      );

      const data = response?.data || {};
      const token = data?.token;

      if (!token) throw new Error("Verification succeeded but no token was returned.");

      const userData = data?.user || { email: email.trim().toLowerCase() };

      if (typeof onLogin === "function") {
        onLogin(userData, rememberMe, token);
      }

      setPassword("");
      setTwoFactorCode("");
      navigate(redirectAfterLogin, { replace: true });
    } catch (err) {
      console.error("[Login 2FA]", err?.response || err);
      setTwoFactorError(
        err?.response?.data?.message || "Invalid or expired code. Please try again.",
      );
    } finally {
      setVerifying2FA(false);
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
          LOGIN CARD
      ====================================================== */}

      <section className="relative w-full max-w-[410px]">
        

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
              mb-7
              text-center
              sm:mb-8
            "
          >
            <h1
              className="text-2xl font-semibold tracking-tight text-ink"
            >
              Welcome Back
            </h1>

            <p
              className="mt-2 text-[13px] font-normal text-muted sm:text-sm"
            >
              Login to your account
            </p>

            
          </header>

          {/* =================================================
              ERROR MESSAGE
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
              FORM
          ================================================== */}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative z-20 w-full"
          >
            {twoFactorRequired ? (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-tint">
                    <i className="ri-lock-line text-[20px] text-accent" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold text-ink">
                    Two-factor verification
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Enter the 6-digit code from your authenticator app, or a recovery code.
                  </p>
                </div>

                {twoFactorError && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-tint px-3 py-2.5 text-xs text-danger">
                    <i className="ri-error-warning-line text-[17px] mt-0.5 shrink-0 text-danger" aria-hidden="true" />
                    <span className="break-words leading-5">{twoFactorError}</span>
                  </div>
                )}

                <label htmlFor="twoFactorCode" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Verification code
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456 or XXXXX-XXXXX"
                  className="mb-5 w-full rounded-lg border border-line-strong bg-white px-3.5 py-2.5 text-center text-lg tracking-[0.3em] text-ink placeholder:tracking-normal placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />

                <button
                  type="submit"
                  disabled={verifying2FA}
                  className="btn btn-primary h-11 w-full"
                >
                  {verifying2FA ? <span className="spinner" aria-hidden="true" /> : <i className="ri-arrow-right-line text-[16px]" aria-hidden="true" />}
                  Verify &amp; sign in
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorRequired(false);
                    setTwoFactorCode("");
                    setTwoFactorError("");
                    setPreAuthToken(null);
                  }}
                  className="mt-3 w-full text-center text-sm text-muted hover:text-ink"
                >
                  Back to login
                </button>
              </>
            ) : (
              <>
            {/* =================================================
                EMAIL
            ================================================== */}

            <div className="mb-5 w-full">
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
                  required
                  disabled={isLoading}
                  className="field h-11 px-10 pr-3"
                />
              </div>
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
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  className="field h-11 px-10 pr-12"
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

              {/* Forgot password */}
              <div className="mt-2 flex justify-end">
                <Link
                  to="/forgotpassword"
                  className="rounded text-[11px] font-medium text-accent transition-colors hover:text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* =================================================
                REMEMBER ME
            ================================================== */}

            <div className="mb-6 flex items-center">
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
                LOGIN BUTTON
            ================================================== */}

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className="btn btn-primary h-11 w-full"
            >
              

              {isLoading ? (
                <>
                  <span className="spinner relative z-10" aria-hidden="true" />

                  <span className="relative z-10">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Login</span>

                  <i className="ri-arrow-right-line text-[17px]" aria-hidden="true" />
                </>
              )}
            </button>
              </>
            )}
          </form>

          {/* =================================================
              DIVIDER
          ================================================== */}

          <div className="my-6 flex w-full items-center gap-3">
            <div className="h-px min-w-0 flex-1 bg-sunken" />

            <span
              className="shrink-0 text-[10px] font-medium text-faint"
            >
              OR
            </span>

            <div className="h-px min-w-0 flex-1 bg-sunken" />
          </div>

          {/* =================================================
              SIGN UP
          ================================================== */}

          <div className="relative z-20 w-full text-center">
            <p className="text-xs text-muted sm:text-[13px]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="rounded font-medium text-accent transition-colors hover:text-accent-hover hover:underline focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* =================================================
              ANTI-PHISHING TRUST NOTE
          ================================================== */}

          <p className="relative z-20 mt-5 text-center text-[11px] leading-relaxed text-faint">
            Always check the address bar before entering your password.
            We will never email, call, or text you asking for it.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Login;
