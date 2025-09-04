import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UserAuth {
  email: string | null;
  role: 'owner' | 'staff' | null;
  operationId: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useUserAuth(): UserAuth {
  const [authState, setAuthState] = useState<UserAuth>({
    email: localStorage.getItem('operatorEmail'),
    role: localStorage.getItem('userRole') as 'owner' | 'staff' | null,
    operationId: localStorage.getItem('operationId') ? parseInt(localStorage.getItem('operationId')!) : null,
    isAuthenticated: !!localStorage.getItem('operatorEmail'),
    isLoading: false,
  });

  // Verify user role if email is present but role is missing
  const { data: userRole, isLoading: isRoleLoading } = useQuery({
    queryKey: ['/api/user-role', authState.email],
    enabled: !!authState.email && !authState.role,
    retry: false,
  });

  useEffect(() => {
    if (userRole && typeof userRole === 'object' && 'role' in userRole && 'operationId' in userRole) {
      const role = userRole.role as 'owner' | 'staff';
      const operationId = userRole.operationId as number;
      
      localStorage.setItem('userRole', role);
      localStorage.setItem('operationId', operationId.toString());
      setAuthState(prev => ({
        ...prev,
        role,
        operationId,
      }));
    }
  }, [userRole]);

  return {
    ...authState,
    isLoading: isRoleLoading,
  };
}

export function hasPermission(userRole: 'owner' | 'staff' | null, requiredPermission: 'invite_staff' | 'manage_operation'): boolean {
  if (!userRole) return false;
  
  switch (requiredPermission) {
    case 'invite_staff':
    case 'manage_operation':
      return userRole === 'owner';
    default:
      return false;
  }
}

export function canPerformPenActions(userRole: 'owner' | 'staff' | null): boolean {
  return userRole === 'owner' || userRole === 'staff';
}

export function canEnterFeedingRecords(userRole: 'owner' | 'staff' | null): boolean {
  return userRole === 'owner' || userRole === 'staff';
}