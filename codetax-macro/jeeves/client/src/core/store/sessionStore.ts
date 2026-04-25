import { create } from 'zustand';
import type { SessionStatus } from '../types';

interface SessionState {
  status: SessionStatus;
  setStatus: (status: Partial<SessionStatus>) => void;
  reset: () => void;
}

const initialStatus: SessionStatus = {
  loggedIn: false,
  isLoggingIn: false,
  isRunning: false,
  progress: { current: 0, total: 0, success: 0, failed: 0 },
};

export const useSessionStore = create<SessionState>((set) => ({
  status: initialStatus,
  setStatus: (partial) =>
    set((state) => ({ status: { ...state.status, ...partial } })),
  reset: () => set({ status: initialStatus }),
}));
