import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { InvitationManager } from '@/components/InvitationManager';
import { BarChart3, UserPlus, Users, Bell } from 'lucide-react';
import { Link } from 'wouter';

export const Invitations: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                CattleNutrition Pro - Consultant Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
                <Button variant="secondary" size="sm">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invitations
                </Button>
                <Link href="/clients">
                  <Button variant="ghost" size="sm">
                    <Users className="w-4 h-4 mr-1" />
                    Clients
                  </Button>
                </Link>
              </div>
              <Bell className="w-5 h-5 text-gray-400" />
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.userType}</p>
                </div>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Invitation Management</h2>
          <p className="text-gray-600 mt-2">
            Invite producers to work with you and manage your client relationships.
          </p>
        </div>
        <InvitationManager />
      </main>
    </div>
  );
};