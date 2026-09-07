// context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(
    localStorage.getItem("token") || sessionStorage.getItem("token"),
  );

  // FIX: axios header useEffect mein set karo — render mein nahi
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/user/me`);
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      // FIX: Sirf 401/403 par logout karo
      // Network error ya server down hone par token mat hatao
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        logout();
      } else {
        console.error("Fetch user error:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/user/register`, userData);
      if (response.data.success) {
        toast.success(response.data.message);
        return { success: true, email: userData.email };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
      return { success: false };
    }
  };

  const verifyOTP = async (email, otp) => {
    try {
      const response = await axios.post(`${API_URL}/user/verify-signup-otp`, {
        email,
        otp,
      });
      if (response.data.success) {
        // Signup ke baad hamesha localStorage — naya account yaad rakhna chahiye
        localStorage.setItem("token", response.data.token);
        sessionStorage.removeItem("token");
        setToken(response.data.token);
        setUser(response.data.user);
        toast.success("Email verified successfully!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Verification failed");
      return { success: false };
    }
  };

  const resendOTP = async (email) => {
    try {
      const response = await axios.post(`${API_URL}/user/resend-signup-otp`, {
        email,
      });
      if (response.data.success) {
        toast.success("OTP resent successfully!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend OTP");
      return { success: false };
    }
  };

  // FIX: remember default = true
  // remember = true  → localStorage  (browser reopen karo, login rahega — 30d)
  // remember = false → sessionStorage (tab/browser band karo, logout ho jayega)
  const login = async (email, password, remember = true) => {
    try {
      const response = await axios.post(`${API_URL}/user/login`, {
        email,
        password,
      });
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;

        if (remember) {
          localStorage.setItem("token", newToken);
          sessionStorage.removeItem("token");
        } else {
          sessionStorage.setItem("token", newToken);
          localStorage.removeItem("token");
        }

        setToken(newToken);
        setUser(newUser);
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
      return { success: false };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    toast.info("Logged out successfully");
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post(`${API_URL}/user/forgot-password`, {
        email,
      });
      if (response.data.success) {
        toast.success("OTP sent to your email!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
      return { success: false };
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(`${API_URL}/user/reset-password`, {
        email,
        otp,
        newPassword,
      });
      if (response.data.success) {
        toast.success("Password reset successfully!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
      return { success: false };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put(`${API_URL}/user/profile`, profileData);
      if (response.data.success) {
        setUser(response.data.user);
        toast.success("Profile updated successfully!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
      return { success: false };
    }
  };

  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.put(`${API_URL}/user/password`, {
        currentPassword,
        newPassword,
      });
      if (response.data.success) {
        toast.success("Password changed successfully!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
      return { success: false };
    }
  };

  const updateProfilePhoto = async (file) => {
    const formData = new FormData();
    formData.append("profilePic", file);

    try {
      const response = await axios.post(
        `${API_URL}/user/profile/photo`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      if (response.data.success) {
        setUser(response.data.user);
        toast.success("Profile photo updated!");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update photo");
      return { success: false };
    }
  };

  const removeProfilePhoto = async () => {
    try {
      const response = await axios.delete(`${API_URL}/user/profile/photo`);
      // FIX: response.data.message → response.data.success
      if (response.data.success) {
        setUser((prev) => ({ ...prev, profilePic: "" }));
        toast.success("Profile photo removed");
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove photo");
      return { success: false };
    }
  };

  const deleteAccount = async () => {
    try {
      const response = await axios.delete(`${API_URL}/user/delete-account`);
      if (response.data.success) {
        toast.success("Account deleted successfully");
        logout();
        return { success: true };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete account");
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        register,
        verifyOTP,
        resendOTP,
        login,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
        updatePassword,
        updateProfilePhoto,
        removeProfilePhoto,
        deleteAccount,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
