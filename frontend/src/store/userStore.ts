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
  hasHydrated: boolean;

  setUser: (user: UserData) => void;
  setPreferences: (preferences: UserPreferences) => void;
  setToken: (token: string) => void;
  setHasHydrated: (v: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: null,
      token: null,
      hasHydrated: false,

      setUser: (user) => set({ user }),
      setPreferences: (preferences) => set({ preferences }),
      setToken: (token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", token);
        }
        set({ token });
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          sessionStorage.removeItem("splash_shown");
        }
        set({ user: null, preferences: null, token: null });
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    {
      name: "user-storage",
      // Only the auth fields persist — `hasHydrated` is derived per-session.
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        // Fires after the persisted slice has been merged in. Without this flag,
        // a `useEffect` reading `token` on first mount sees `null` and bounces
        // the user back to /login *before* the persisted token is restored.
        state?.setHasHydrated(true);
      },
    },
  ),
);
