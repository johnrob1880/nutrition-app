import { useState, useEffect } from 'react';
import { User, api } from '@/lib/api';
import { getStoredToken, getStoredUser, setStoredUser, clearStoredAuth, isTokenExpired } from '@/lib/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      const user = getStoredUser();

      if (!token || !user) {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      if (isTokenExpired(token)) {
        try {
          const response = await api.refreshToken();
          if (response.success && response.accessToken) {
            localStorage.setItem('accessToken', response.accessToken);
            setAuthState({ user, isAuthenticated: true, isLoading: false });
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (error) {
          clearStoredAuth();
          setAuthState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setAuthState({ user, isAuthenticated: true, isLoading: false });
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: { username?: string; email?: string; password: string }) => {
    try {
      const response = await api.login(credentials);
      if (response.success) {
        setStoredUser(response.user);
        setAuthState({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      } else {
        return { success: false, error: 'Login failed' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearStoredAuth();
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  };

  const register = async (data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    specialization: 'nutritionist' | 'veterinarian';
  }) => {
    try {
      const response = await api.register(data);
      return { success: true, data: response };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    ...authState,
    login,
    logout,
    register,
  };
};