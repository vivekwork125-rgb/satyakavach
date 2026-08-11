import React, { createContext, useContext, useState, useEffect } from 'react';

// SupabaseUser-compatible shape for existing component compatibility
export interface User {
  id: string;
  email: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Use proxy or direct URL for API calls
const API_BASE = import.meta.env.VITE_API_URL || "";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('satyakavach_token');
    return {
      user: null,
      isAdmin: false,
      loading: hasToken, // Only set loading to true if there is a token to verify!
    };
  });

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('satyakavach_token');
      if (!token) {
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const { user } = await res.json();
          setState({
            user,
            isAdmin: user.role === 'admin' || user.email === import.meta.env.VITE_ADMIN_EMAIL,
            loading: false
          });
        } else {
          localStorage.removeItem('satyakavach_token');
          setState({ user: null, isAdmin: false, loading: false });
        }
      } catch (err) {
        clearTimeout(timer);
        localStorage.removeItem('satyakavach_token');
        setState({ user: null, isAdmin: false, loading: false });
      } finally {
        // Guarantee loading is false no matter what
        setState((s) => ({ ...s, loading: false }));
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      localStorage.setItem('satyakavach_token', data.token);
      setState({
        user: data.user,
        isAdmin: data.user.role === 'admin' || data.user.email === import.meta.env.VITE_ADMIN_EMAIL,
        loading: false
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }
      
      // Auto login
      localStorage.setItem('satyakavach_token', data.token);
      setState({
        user: data.user,
        isAdmin: data.user.role === 'admin' || data.user.email === import.meta.env.VITE_ADMIN_EMAIL,
        loading: false
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('satyakavach_token');
    setState({ user: null, isAdmin: false, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};


