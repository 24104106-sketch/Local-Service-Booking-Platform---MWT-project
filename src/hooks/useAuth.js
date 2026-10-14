import { useContext, useState, useCallback } from "react";
import { UserContext } from "../context/UserContext";
import apiClient, { setAuthToken } from "../api/apiClient";

/**
 * Custom hook — the single entry point for anything auth-related.
 * Connects directly to the Node.js / Express backend with JWT tokens.
 */
export function useAuth() {
  const { user, login: setUser, logout: clearUser } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useCallback(
    async (credentials) => {
      setLoading(true);
      setError("");
      try {
        const payload = {
          email: (credentials.email || "").trim(),
          password: credentials.password,
        };

        const res = await apiClient.post('/auth/login', payload);
        if (res && res.success) {
          const authUser = res.user || (res.data && res.data.user);
          const token = res.token || (res.data && res.data.token);
          if (token) setAuthToken(token);
          if (authUser) setUser(authUser);
          return authUser;
        }

        throw new Error(res.message || "Invalid email or password");
      } catch (err) {
        const errMsg = err.message || "Login failed. Please check your credentials.";
        setError(errMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const register = useCallback(
    async (formData) => {
      setLoading(true);
      setError("");
      try {
        const payload = {
          ...formData,
          name: (formData.name || formData.fullName || "").trim(),
          fullName: (formData.fullName || formData.name || "").trim(),
        };
        const res = await apiClient.post('/auth/register', payload);
        if (res && res.success) {
          const newUser = res.user || (res.data && res.data.user);
          const token = res.token || (res.data && res.data.token);
          if (token) setAuthToken(token);
          if (newUser) setUser(newUser);
          return newUser;
        }
        throw new Error(res.message || "Registration failed");
      } catch (err) {
        const errMsg = err.message || "Registration failed. Please try again.";
        setError(errMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    clearUser();
  }, [clearUser]);

  const updateProfile = useCallback(
    async (updates) => {
      try {
        await apiClient.put('/auth/profile', updates).catch(() => {});
      } catch {
        // Silent catch for profile sync
      }
      setUser({ ...user, ...updates });
    },
    [user, setUser]
  );

  const googleLogin = useCallback(
    async (credential) => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.post('/auth/google', { credential });
        if (res && res.success) {
          const authUser = res.user || (res.data && res.data.user);
          const token = res.token || (res.data && res.data.token);
          if (token) setAuthToken(token);
          if (authUser) setUser(authUser);
          return authUser;
        }
        throw new Error(res.message || "Google login failed");
      } catch (err) {
        const errMsg = err.message || "Google sign-in failed.";
        setError(errMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const requestPasswordReset = useCallback(async (email) => {
    return apiClient.post('/auth/forgot-password', { email: (email || '').trim() });
  }, []);

  const confirmPasswordReset = useCallback(async (token, newPassword) => {
    return apiClient.post('/auth/reset-password', { token: (token || '').trim(), newPassword });
  }, []);

  const clearError = useCallback(() => setError(""), []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    googleLogin,
    register,
    logout,
    updateProfile,
    requestPasswordReset,
    confirmPasswordReset,
    clearError,
  };
}
