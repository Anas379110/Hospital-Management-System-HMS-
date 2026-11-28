import { flushSync } from 'react-dom';
import { clearSessionQueries } from '../api/sessionIsolation';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { CurrentUser } from '../types/api';

interface AuthContextValue {
  user: CurrentUser | null;
  login: (username: string, password: string) => Promise<void>;
  startDemo: () => Promise<void>;
  switchDemoRole: (role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem('hms_user');
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  });

  useEffect(() => { const changed = (event: StorageEvent) => { if(event.key === 'hms_token' || event.key === 'hms_user' || event.key === null) { let next: CurrentUser | null = null;try { const raw = localStorage.getItem('hms_user');next = event.key === 'hms_user' && raw ? JSON.parse(raw) as CurrentUser : null; } catch { next = null; } flushSync(() => setUser(next));clearSessionQueries(); } };window.addEventListener('storage',changed);return () => window.removeEventListener('storage',changed); }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const { accessToken, user: loggedInUser } = res.data;
    clearSessionQueries();
    localStorage.setItem('hms_token', accessToken);
    localStorage.setItem(
      'hms_user',
      JSON.stringify({ userId: loggedInUser.id, username: loggedInUser.username, role: loggedInUser.role }),
    );
    setUser({ userId: loggedInUser.id, username: loggedInUser.username, role: loggedInUser.role });
  }, []);

  const saveDemo = useCallback((data: {accessToken:string;user:{id:string;username:string;role:CurrentUser['role']}}) => {
    clearSessionQueries();
    const next={userId:data.user.id,username:data.user.username,role:data.user.role};
    localStorage.setItem('hms_token',data.accessToken);localStorage.setItem('hms_user',JSON.stringify(next));localStorage.setItem('hms_demo','true');setUser(next);
  },[]);
  const startDemo=useCallback(async()=>{const {data}=await apiClient.post('/demo/start',{});saveDemo(data);},[saveDemo]);
  const switchDemoRole=useCallback(async(role:string)=>{const {data}=await apiClient.post('/demo/role',{role});saveDemo(data);window.location.href='/';},[saveDemo]);
  const logout = useCallback(() => {
    clearSessionQueries();
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout, startDemo, switchDemoRole }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  return ctx;
}
