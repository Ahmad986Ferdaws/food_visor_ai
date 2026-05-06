"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserData {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface UserPreferences {
  dietaryConstraints: string[];
  allergies: string[];
  goals: string[];
  likedItems: string[];
  dislikedItems: string[];
}

interface UserStore {
  user: UserData | null;
  preferences: UserPreferences | null;
  token: string | null;

  setUser: (user: UserData) => void;
  setPreferences: (preferences: UserPreferences) => void;
  setToken: (token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: null,
      token: null,

      setUser: (user) => set({ user }),
      setPreferences: (preferences) => set({ preferences }),
      setToken: (token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", token);
        }
        set({ token });
      },
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          sessionStorage.removeItem("splash_shown");
        }
        set({ user: null, preferences: null, token: null });
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    { name: "user-storage" }
  )
);
