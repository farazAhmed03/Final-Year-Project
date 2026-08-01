import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { ensureCsrfToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data.data.user);
      return response.data.data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await ensureCsrfToken();
        const response = await api.get("/auth/me");
        if (active) setUser(response.data.data.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const expired = () => setUser(null);
    window.addEventListener("legalsphere:session-expired", expired);
    return () => {
      active = false;
      window.removeEventListener("legalsphere:session-expired", expired);
    };
  }, []);

  const login = useCallback(async (payload) => {
    const response = await api.post("/auth/login", payload);
    const nextUser = response.data.data.user;
    setUser(nextUser);
    return nextUser;
  }, []);

  const googleLogin = useCallback(async (idToken, role) => {
    const response = await api.post("/auth/google", { idToken, role });
    const nextUser = response.data.data.user;
    setUser(nextUser);
    return nextUser;
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const response = await api.post("/auth/verify-email", { token });
    const nextUser = response.data.data.user;
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((nextUser) => setUser(nextUser), []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    googleLogin,
    verifyEmail,
    logout,
    refreshUser,
    updateUser
  }), [user, loading, login, googleLogin, verifyEmail, logout, refreshUser, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
