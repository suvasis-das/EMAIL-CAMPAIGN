'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, removeStoredToken, setStoredToken, User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-hydrate session from localStorage on initial page load
  useEffect(() => {
    let active = true;

    async function loadUser() {
      const stored = getStoredToken();
      if (!stored) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        setToken(stored);
        const { user: profile } = await api.getMe();
        if (active) {
          setUser(profile);
        }
      } catch {
        // If token is expired or invalid, remove it
        removeStoredToken();
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login({ email, password });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.register({ name, email, password });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    removeStoredToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
