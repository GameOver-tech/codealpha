import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  adminSession: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setAdminSession: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminSession, setAdminSession] = useState<string | null>(
    () => localStorage.getItem('admin_token')
  );
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);

  // Single source of truth: listen for auth state changes (fires INITIAL_SESSION on mount)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          validateSession(session.access_token);
        } else {
          setUser(null);
          if (!validated) {
            setLoading(false);
            setValidated(true);
          }
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (adminSession) {
      localStorage.setItem('admin_token', adminSession);
    } else {
      localStorage.removeItem('admin_token');
    }
  }, [adminSession]);

  async function validateSession(token: string) {
    try {
      const data = await api.get('/auth/verify');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      if (!validated) {
        setLoading(false);
        setValidated(true);
      }
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAdminSession(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, adminSession, loading, signInWithGoogle, signOut, setAdminSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
