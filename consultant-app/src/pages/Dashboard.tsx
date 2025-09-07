import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvitationManager } from '@/components/InvitationManager';
import { Users, UserPlus, Settings, BarChart3, Bell, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { data: dashboardData, loading: dashboardLoading, refresh: refreshDashboard } = useDashboard();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invitations'>('dashboard');
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                CattleNutrition Pro - Consultant Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button 
                  variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setActiveTab('dashboard')}
                >
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
                <Button 
                  variant={activeTab === 'invitations' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setActiveTab('invitations')}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invitations
                </Button>
              </div>
              <Bell className="w-5 h-5 text-gray-400" />
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.userType}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-600 mt-2">
                  Welcome back! Here's an overview of your consultant activity.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={dashboardLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${dashboardLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData?.stats.activeClients ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData?.stats.activeClients === 0 ? 'No clients yet' : 'Active producers'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData?.stats.pendingInvitations ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData?.stats.pendingInvitations === 0 ? 'No pending invites' : 'Awaiting response'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Operations Managed</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData?.stats.operationsManaged ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData?.stats.operationsManaged === 0 ? 'No operations yet' : 'Operations under management'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Profile Complete</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData?.stats.profileCompleteness ?? 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData?.profileComplete ? 'Profile complete!' : 'Complete your profile'}
                  </p>
                </CardContent>
              </Card>
            </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Complete these steps to begin managing clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Complete Your Profile</h4>
                  <p className="text-sm text-gray-600">Add credentials and contact information</p>
                </div>
                <Button size="sm">Complete</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Invite Your First Client</h4>
                  <p className="text-sm text-gray-600">Send an invitation to a producer</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('invitations')}>
                  Invite
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest interactions and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'invitation_sent' && <UserPlus className="w-4 h-4 text-blue-500" />}
                        {activity.type === 'invitation_accepted' && <Users className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleDateString()} at{' '}
                          {new Date(activity.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No recent activity</p>
                  <p className="text-sm">Activity will appear here as you work with clients</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </>
        )}

        {activeTab === 'invitations' && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900">Invitation Management</h2>
              <p className="text-gray-600 mt-2">
                Invite producers to work with you and manage your client relationships.
              </p>
            </div>
            <InvitationManager />
          </div>
        )}
      </main>
    </div>
  );
};