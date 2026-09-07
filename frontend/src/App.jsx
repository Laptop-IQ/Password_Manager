import React, { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import axios from "axios";
import Navbar from "./components/Navbar";

import Login from "./Context/Login";
import Signup from "./Context/Signup";
import VerifyOtp from "./Context/VerifyOtp";
import ForgotPassword from "./Context/ForgotPassword";
import Hero from "./components/Hero";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const API_USER_URL = `${API_BASE}/api/user`;

const STORAGE_KEYS = {
  USER: "user",
  TOKEN: "token",
};

function safeGetItem(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    console.error(`[Storage] Failed to read "${key}"`, error);
    return null;
  }
}

function safeSetItem(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`[Storage] Failed to write "${key}"`, error);
    return false;
  }
}

function safeRemoveItem(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    console.error(`[Storage] Failed to remove "${key}"`, error);
  }
}

function parseJSON(value, fallback = null) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[Storage] Invalid JSON:", error);
    return fallback;
  }
}

// --------------------------------------------------
// Auth Storage
// --------------------------------------------------

function getStoredAuth() {
  const localToken = safeGetItem(localStorage, STORAGE_KEYS.TOKEN);
  const sessionToken = safeGetItem(sessionStorage, STORAGE_KEYS.TOKEN);

  const localUser = parseJSON(
    safeGetItem(localStorage, STORAGE_KEYS.USER),
    null,
  );

  const sessionUser = parseJSON(
    safeGetItem(sessionStorage, STORAGE_KEYS.USER),
    null,
  );

  if (localToken) {
    return {
      token: localToken,
      user: localUser,
      persistent: true,
    };
  }

  if (sessionToken) {
    return {
      token: sessionToken,
      user: sessionUser,
      persistent: false,
    };
  }

  return {
    token: null,
    user: null,
    persistent: false,
  };
}

function clearStoredAuth() {
  safeRemoveItem(localStorage, STORAGE_KEYS.USER);
  safeRemoveItem(localStorage, STORAGE_KEYS.TOKEN);

  safeRemoveItem(sessionStorage, STORAGE_KEYS.USER);
  safeRemoveItem(sessionStorage, STORAGE_KEYS.TOKEN);
}

// --------------------------------------------------
// Scroll To Top
// --------------------------------------------------

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  return null;
}

// --------------------------------------------------
// Loading Screen
// --------------------------------------------------

function LoadingScreen() {
  return (
    <div
      className="min-h-screen bg-[#0A0810] flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center">
        <div
          className="
            w-10
            h-10
            rounded-full
            border-2
            border-white/10
            border-t-[#8B72FF]
            animate-spin
          "
        />

        <p className="mt-4 text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Public Only Route
// --------------------------------------------------

function PublicOnlyRoute({ user, token, children }) {
  if (user && token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function HomePage({ user, token, onLogout }) {
  const navigate = useNavigate();

  const handleLoginRedirect = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  return (
    <>
      {/* FIX: Pass token prop to Hero */}
      <Hero token={token} />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistAuth = useCallback((userData, tokenValue, remember = false) => {
    if (!tokenValue) {
      console.error("[Auth] Token is missing.");
      return false;
    }

    const targetStorage = remember ? localStorage : sessionStorage;

    const otherStorage = remember ? sessionStorage : localStorage;

    // Remove old auth from the other storage.
    safeRemoveItem(otherStorage, STORAGE_KEYS.USER);
    safeRemoveItem(otherStorage, STORAGE_KEYS.TOKEN);

    // Save user.
    const userSaved = userData
      ? safeSetItem(targetStorage, STORAGE_KEYS.USER, JSON.stringify(userData))
      : true;

    // Save token.
    const tokenSaved = safeSetItem(
      targetStorage,
      STORAGE_KEYS.TOKEN,
      tokenValue,
    );

    if (!userSaved || !tokenSaved) {
      console.error("[Auth] Failed to persist authentication.");
      return false;
    }

    setUser(userData || null);
    setToken(tokenValue);

    return true;
  }, []);

  // ------------------------------------------------
  // Logout
  // ------------------------------------------------

  const handleLogout = useCallback(() => {
    clearStoredAuth();

    setUser(null);
    setToken(null);
  }, []);

  // ------------------------------------------------
  // Bootstrap Authentication
  // ------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const storedAuth = getStoredAuth();

      // No stored token.
      if (!storedAuth.token) {
        if (!mounted) return;

        setUser(null);
        setToken(null);
        setIsLoading(false);

        return;
      }

      // Immediately restore stored auth.
      if (mounted) {
        setUser(storedAuth.user || null);
        setToken(storedAuth.token);
      }

      // API is not configured.
      if (!API_BASE) {
        console.warn("[Auth] API base URL is not configured.");

        if (mounted) {
          setIsLoading(false);
        }

        return;
      }

      try {
        const response = await axios.get(`${API_USER_URL}/me`, {
          headers: {
            Authorization: `Bearer ${storedAuth.token}`,
          },

          timeout: 10000,

          params: {
            _t: Date.now(),
          },
        });

        if (!mounted) return;

        const profile = response?.data;

        if (!profile) {
          throw new Error("Invalid user profile received from server.");
        }

        persistAuth(profile, storedAuth.token, storedAuth.persistent);
      } catch (error) {
        const status = error?.response?.status;

        console.warn(
          "[Auth] Token validation failed:",
          status || error?.message,
        );

        if (mounted && (status === 401 || status === 403)) {
          clearStoredAuth();

          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, [persistAuth]);

  // ------------------------------------------------
  // Login
  // ------------------------------------------------

  const handleLogin = useCallback(
    (userData, remember, tokenValue) => {
      const success = persistAuth(userData, tokenValue, remember);

      if (!success) {
        console.error("[Login] Authentication persistence failed.");

        return false;
      }

      return true;
    },
    [persistAuth],
  );

  // ------------------------------------------------
  // Signup
  // ------------------------------------------------

  const handleSignup = useCallback(
    (userData, remember, tokenValue) => {
      const success = persistAuth(userData, tokenValue, remember);

      if (!success) {
        console.error("[Signup] Authentication persistence failed.");

        return false;
      }

      return true;
    },
    [persistAuth],
  );

  // ------------------------------------------------
  // Initial Loading
  // ------------------------------------------------

  if (isLoading) {
    return <LoadingScreen />;
  }

  // ------------------------------------------------
  // Routes
  // ------------------------------------------------

  return (
    <>
      <ScrollToTop />
      <Navbar user={user} onLogout={handleLogout} />
      <main className="pt-16">
        <Routes>
          {/* Home */}
          <Route
            path="/"
            element={
              <HomePage user={user} token={token} onLogout={handleLogout} />
            }
          />
         
          {/* Login */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute user={user} token={token}>
                <Login onLogin={handleLogin} />
              </PublicOnlyRoute>
            }
          />

          {/* Signup */}
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute user={user} token={token}>
                <Signup onSignup={handleSignup} />
              </PublicOnlyRoute>
            }
          />

          {/* Register -> Signup */}
          <Route path="/register" element={<Navigate to="/signup" replace />} />

          {/* OTP Verification */}
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* Forgot Password */}
          <Route path="/forgotpassword" element={<ForgotPassword />} />

          {/* Case-sensitive/legacy route */}
          <Route
            path="/ForgotPassword"
            element={<Navigate to="/forgotpassword" replace />}
          />

          {/* Unknown Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
