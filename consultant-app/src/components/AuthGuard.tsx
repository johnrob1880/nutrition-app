import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { requireConsultant } from '@/lib/auth';
import { useLocation } from 'wouter';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireConsultantRole?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  requireConsultantRole = true,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="text-lg font-medium text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Redirect to login if auth is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    setLocation('/login');
    return null;
  }

  // Check if consultant role is required
  if (requireConsultantRole && user && !requireConsultant(user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">This portal is for consultants only.</p>
        </div>
      </div>
    );
  }

  // Redirect authenticated users away from auth pages
  if (!requireAuth && isAuthenticated) {
    setLocation('/dashboard');
    return null;
  }

  return <>{children}</>;
};