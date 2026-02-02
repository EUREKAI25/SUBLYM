import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  requestMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    isLoading: true,
  });

  // Vérifier le token au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token || token === 'undefined' || token === 'null') {
        localStorage.removeItem('auth_token');
        setState({ user: null, token: null, isLoading: false });
        return;
      }

      try {
        const response = await fetchWithAuth(API_ENDPOINTS.me);
        if (response.ok) {
          const data = await response.json();
          const user = data.user || data;
          setState({ user, token, isLoading: false });
        } else {
          localStorage.removeItem('auth_token');
          setState({ user: null, token: null, isLoading: false });
        }
      } catch {
        localStorage.removeItem('auth_token');
        setState({ user: null, token: null, isLoading: false });
      }
    };

    checkAuth();
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.requestMagicLink, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        return { success: true };
      }

      const error = await response.json();
      return { success: false, error: error.message || 'Erreur lors de l\'envoi' };
    } catch {
      return { success: false, error: 'Erreur de connexion au serveur' };
    }
  }, []);

  const verifyToken = useCallback(async (token: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.verifyToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        // Le backend retourne accessToken (camelCase)
        const accessToken = data.accessToken || data.access_token;
        const user = data.user;
        
        if (accessToken) {
          localStorage.setItem('auth_token', accessToken);
          setState({ user, token: accessToken, isLoading: false });
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('verifyToken error:', err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setState({ user: null, token: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, requestMagicLink, verifyToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
