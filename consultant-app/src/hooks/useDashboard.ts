import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface DashboardStats {
  activeClients: number;
  pendingInvitations: number;
  operationsManaged: number;
  profileCompleteness: number;
}

interface RecentActivity {
  id: string;
  type: 'invitation_sent' | 'invitation_accepted' | 'profile_updated';
  description: string;
  timestamp: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  profileComplete: boolean;
}

export const useDashboard = () => {
  const { } = useAuth();
  
  // Get token from localStorage (same as useAuth does internally)  
  const token = localStorage.getItem('accessToken');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/consultant/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboardData
  };
};