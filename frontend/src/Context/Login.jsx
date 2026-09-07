import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
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
     UI
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
          LOGIN CARD
      ====================================================== */}

      <section className="relative w-full max-w-[410px]">
        {/* Thin gradient outline */}
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
            py-8
            shadow-[0_20px_55px_rgba(76,29,149,0.14)]
            sm:px-9
            sm:py-9
          "
        >
          {/* =================================================
              SMALL INNER GLOW
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
              
              Positioned inside card at top-right.
              Small enough that it NEVER touches the heading.
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
              gap-[6px]
              opacity-25
            "
          >
            {Array.from({ length: 25 }).map((_, index) => (
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
              sm:mb-8
            "
          >
            <h1
              className="
                whitespace-nowrap
                text-[29px]
                font-extrabold
                leading-tight
                tracking-[-0.03em]
                text-transparent
                bg-gradient-to-r
                from-[#7c3aed]
                via-[#c026d3]
                to-[#3b82f6]
                bg-clip-text
                sm:text-[32px]
              "
            >
              Welcome Back
            </h1>

            <p
              className="
                mt-2
                text-[13px]
                font-normal
                text-gray-500
                sm:text-sm
              "
            >
              Login to your account
            </p>

            {/* Small gradient underline */}
            <div
              aria-hidden="true"
              className="
                mx-auto
                mt-4
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
                className="mt-0.5 shrink-0 text-red-500"
                aria-hidden="true"
              />

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
            {/* =================================================
                EMAIL
            ================================================== */}

            <div className="mb-5 w-full">
              <label
                htmlFor="email"
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
                  aria-hidden="true"
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
                />

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

            {/* =================================================
                PASSWORD
            ================================================== */}

            <div className="mb-4 w-full">
              <label
                htmlFor="password"
                className="
                  mb-2
                  block
                  text-[13px]
                  font-semibold
                  text-gray-700
                "
              >
                Password
              </label>

              <div className="group relative w-full">
                <Lock
                  size={18}
                  aria-hidden="true"
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
                />

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

                {/* Password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
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
                    focus:ring-2
                    focus:ring-purple-500/30
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

              {/* Forgot password */}
              <div className="mt-2 flex justify-end">
                <Link
                  to="/forgotpassword"
                  className="
                    rounded
                    text-[11px]
                    font-medium
                    text-blue-600
                    transition-colors
                    hover:text-purple-600
                    hover:underline
                    focus:outline-none
                    focus:ring-2
                    focus:ring-purple-500/30
                  "
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
                className="
                  h-4
                  w-4
                  shrink-0
                  cursor-pointer
                  rounded
                  border-gray-300
                  accent-purple-600
                  focus:ring-2
                  focus:ring-purple-500/30
                  disabled:cursor-not-allowed
                "
              />

              <label
                htmlFor="remember"
                className="
                  ml-2
                  cursor-pointer
                  select-none
                  text-[11px]
                  text-gray-500
                "
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
              {/* Shine */}
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

                  <span className="relative z-10">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Login</span>

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
              DIVIDER
          ================================================== */}

          <div className="my-6 flex w-full items-center gap-3">
            <div className="h-px min-w-0 flex-1 bg-gray-200" />

            <span
              className="
                shrink-0
                text-[10px]
                font-medium
                text-gray-400
              "
            >
              OR
            </span>

            <div className="h-px min-w-0 flex-1 bg-gray-200" />
          </div>

          {/* =================================================
              SIGN UP
          ================================================== */}

          <div className="relative z-20 w-full text-center">
            <p className="text-xs text-gray-500 sm:text-[13px]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="
                  rounded
                  font-bold
                  text-purple-600
                  transition-colors
                  hover:text-blue-600
                  hover:underline
                  focus:outline-none
                  focus:ring-2
                  focus:ring-purple-500/30
                "
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
