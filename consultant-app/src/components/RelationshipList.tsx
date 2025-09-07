import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, MapPin, Calendar, Pause, Play, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Relationship {
  id: number;
  permissions: {
    view: boolean;
    edit: boolean;
    admin: boolean;
  };
  status: 'active' | 'suspended' | 'inactive';
  establishedAt: string;
  producer: {
    id: number;
    username: string;
    email: string;
  };
  operation: {
    id: number;
    name: string;
    location: string;
  };
}

async function fetchRelationships(): Promise<Relationship[]> {
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const response = await fetch('/api/consultant/relationships', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Check if response is HTML (likely means route not found)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    console.error('API returned HTML instead of JSON - endpoint might not exist');
    throw new Error('API endpoint not found - server may not be configured correctly');
  }
  
  if (!response.ok) {
    let errorMessage = `Failed to fetch relationships (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // If response isn't JSON, use default message
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  return data.relationships || [];
}

async function updateRelationshipStatus(relationshipId: number, action: 'suspend' | 'reactivate' | 'delete') {
  const token = localStorage.getItem('accessToken');
  let endpoint = `/api/consultant/relationships/${relationshipId}`;
  let method = 'PATCH';
  
  if (action === 'suspend') {
    endpoint += '/suspend';
  } else if (action === 'reactivate') {
    endpoint += '/reactivate';
  } else if (action === 'delete') {
    method = 'DELETE';
  }
  
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to ${action} relationship`);
  }
  
  return response.json();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'suspended':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPermissionLevel(permissions: Relationship['permissions']) {
  if (permissions.admin) return 'Admin';
  if (permissions.edit) return 'Edit';
  if (permissions.view) return 'View';
  return 'None';
}

function getPermissionColor(permissions: Relationship['permissions']) {
  if (permissions.admin) return 'bg-red-100 text-red-800';
  if (permissions.edit) return 'bg-blue-100 text-blue-800';
  if (permissions.view) return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

export const RelationshipList: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<{ [key: number]: string }>({});

  const { 
    data: relationships, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['relationships'],
    queryFn: fetchRelationships,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const relationshipMutation = useMutation({
    mutationFn: ({ relationshipId, action }: { relationshipId: number; action: 'suspend' | 'reactivate' | 'delete' }) =>
      updateRelationshipStatus(relationshipId, action),
    onMutate: ({ relationshipId, action }) => {
      setActionLoading(prev => ({ ...prev, [relationshipId]: action }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      console.error('Relationship action error:', error);
    },
    onSettled: (_, __, { relationshipId }) => {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[relationshipId];
        return newState;
      });
    }
  });

  const handleAction = (relationshipId: number, action: 'suspend' | 'reactivate' | 'delete') => {
    relationshipMutation.mutate({ relationshipId, action });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p>Failed to load relationships</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['relationships'] })}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!relationships || relationships.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No Client Relationships</p>
            <p className="text-sm mt-1">
              Client relationships will appear here once producers accept your invitations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {relationships.map((relationship) => (
        <Card key={relationship.id} className="border-gray-300">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{relationship.operation.name}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {relationship.producer.username}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {relationship.operation.location}
                  </span>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge className={getStatusColor(relationship.status)}>
                  {relationship.status.charAt(0).toUpperCase() + relationship.status.slice(1)}
                </Badge>
                <Badge className={getPermissionColor(relationship.permissions)}>
                  {getPermissionLevel(relationship.permissions)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="w-4 h-4" />
                  Established {format(new Date(relationship.establishedAt), 'MMM d, yyyy')}
                </div>
                <div className="text-xs">
                  Contact: {relationship.producer.email}
                </div>
              </div>
              
              <div className="flex gap-2">
                {relationship.status === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(relationship.id, 'suspend')}
                    disabled={actionLoading[relationship.id] === 'suspend'}
                    className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                  >
                    {actionLoading[relationship.id] === 'suspend' ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </Button>
                )}
                
                {relationship.status === 'suspended' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(relationship.id, 'reactivate')}
                    disabled={actionLoading[relationship.id] === 'reactivate'}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    {actionLoading[relationship.id] === 'reactivate' ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(relationship.id, 'delete')}
                  disabled={actionLoading[relationship.id] === 'delete'}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  {actionLoading[relationship.id] === 'delete' ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};