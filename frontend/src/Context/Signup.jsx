import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
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
              
              Small, inside card, top-right.
              Does NOT overlap the heading.
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

            {/* Heading */}

            <h1
              className="
                whitespace-nowrap
                px-8
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
                sm:text-[31px]
              "
            >
              Create Account
            </h1>

            <p
              className="
                mt-2
                px-4
                text-[12px]
                font-normal
                leading-5
                text-gray-500
                sm:text-[13px]
              "
            >
              Join ExpenseTracker to manage your finances
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
              API ERROR
          ================================================== */}

          {errors.api && (
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
                className="
                  mb-2
                  block
                  text-[13px]
                  font-semibold
                  text-gray-700
                "
              >
                Full Name
              </label>

              <div className="group relative w-full">
                <User
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
                    box-border
                    block
                    h-[46px]
                    w-full
                    min-w-0
                    rounded-[10px]
                    border
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
                    ${
                      errors.name
                        ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                        : "border-gray-200"
                    }
                  `}
                />
              </div>

              {errors.name && (
                <p
                  className="
                    mt-1.5
                    text-[11px]
                    leading-4
                    text-red-500
                  "
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
                  maxLength={254}
                  required
                  disabled={isLoading}
                  className={`
                    box-border
                    block
                    h-[46px]
                    w-full
                    min-w-0
                    rounded-[10px]
                    border
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
                    ${
                      errors.email
                        ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                        : "border-gray-200"
                    }
                  `}
                />
              </div>

              {errors.email && (
                <p
                  className="
                    mt-1.5
                    text-[11px]
                    leading-4
                    text-red-500
                  "
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
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  disabled={isLoading}
                  className={`
                    box-border
                    block
                    h-[46px]
                    w-full
                    min-w-0
                    rounded-[10px]
                    border
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
                    ${
                      errors.password
                        ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                        : "border-gray-200"
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

              {errors.password && (
                <p
                  className="
                    mt-1.5
                    text-[11px]
                    leading-4
                    text-red-500
                  "
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
                CREATE ACCOUNT BUTTON
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

                  <span className="relative z-10">Creating account...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Create Account</span>

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

          <div className="my-5 flex w-full items-center gap-3">
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
              SIGN IN
          ================================================== */}

          <div className="relative z-20 w-full text-center">
            <p className="text-xs text-gray-500 sm:text-[13px]">
              Already have an account?{" "}
              <Link
                to="/login"
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
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Signup;
