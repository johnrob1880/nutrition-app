import { User } from './api';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const getStoredToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

export const getStoredUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearStoredAuth = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

export const requireConsultant = (user: User | null): boolean => {
  return user?.userType === 'consultant';
};