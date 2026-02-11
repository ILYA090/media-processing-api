import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, AiSettings } from '@/types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  aiSettings: AiSettings | null;

  setUser: (user: User) => void;
  setOrganization: (organization: Organization) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAiSettings: (aiSettings: AiSettings) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organization: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      aiSettings: null,

      setUser: (user) => set({ user, isAuthenticated: true }),
      setOrganization: (organization) => set({ organization }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setAiSettings: (aiSettings) => set({ aiSettings }),
      logout: () =>
        set({
          user: null,
          organization: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          aiSettings: null,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        aiSettings: state.aiSettings,
      }),
    }
  )
);
