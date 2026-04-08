import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useApi } from './useApi';

export function useSession() {
  const { status, setStatus } = useSessionStore();
  const api = useApi();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/status');
      setStatus(data);
    } catch {
      /* server offline */
    }
  }, [api, setStatus]);

  const login = useCallback(async () => {
    await api.post('/login');
  }, [api]);

  const logout = useCallback(async () => {
    await api.post('/logout');
    setStatus({ loggedIn: false, isLoggingIn: false, isRunning: false });
  }, [api, setStatus]);

  return { status, fetchStatus, login, logout, setStatus };
}
