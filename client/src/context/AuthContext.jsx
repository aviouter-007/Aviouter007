import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('aviouter_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    const fetchMe = () => {
      api
        .me(token)
        .then(({ user: u }) => setUser(u))
        .catch(() => {
          localStorage.removeItem('aviouter_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    };

    fetchMe();
    const interval = setInterval(fetchMe, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Handle Google OAuth callback — Supabase fires onAuthStateChange after redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
        // Only handle if we don't already have our own token (avoid loop)
        const existing = localStorage.getItem('aviouter_token');
        if (existing) return;
        try {
          const data = await api.loginWithGoogle(session.access_token);
          localStorage.setItem('aviouter_token', data.token);
          setToken(data.token);
          setUser(data.user);
        } catch (e) {
          console.error('Google auth failed:', e.message);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem('aviouter_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, reference) => {
    const data = await api.register({ email, password, reference });
    localStorage.setItem('aviouter_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async () => {
    // Clear any existing token so the onAuthStateChange handler picks it up
    localStorage.removeItem('aviouter_token');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    localStorage.removeItem('aviouter_token');
    setToken(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  const refreshUser = async () => {
    if (!token) return;
    const { user: u } = await api.me(token);
    setUser(u);
    return u;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, loginWithGoogle, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
