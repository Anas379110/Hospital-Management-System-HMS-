import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { CurrentUser } from '../types/api';

interface AuthContextValue {
  user: CurrentUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem('hms_user');
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  });

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { accessToken, user: loggedInUser } = res.data;
    localStorage.setItem('hms_token', accessToken);
    localStorage.setItem(
      'hms_user',
      JSON.stringify({ userId: loggedInUser.id, username: loggedInUser.username, role: loggedInUser.role }),
    );
    setUser({ userId: loggedInUser.id, username: loggedInUser.username, role: loggedInUser.role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  return ctx;
}
