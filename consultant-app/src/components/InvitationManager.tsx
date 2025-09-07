import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, RefreshCw, X, Calendar, User, MessageCircle } from 'lucide-react';

interface Invitation {
  id: number;
  producerEmail: string;
  producerName: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  declinedAt?: string;
}

interface CreateInvitationData {
  producerEmail: string;
  producerName: string;
  message: string;
}

export const InvitationManager: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateInvitationData>({
    producerEmail: '',
    producerName: '',
    message: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/consultant/invitations?page=${pagination.page}&limit=${pagination.limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to fetch invitations');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/consultant/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: data.emailSent ? 
            "Invitation sent successfully!" : 
            "Invitation created (email delivery failed)"
        });
        setIsCreateDialogOpen(false);
        setFormData({ producerEmail: '', producerName: '', message: '' });
        fetchInvitations(); // Refresh list
      } else {
        throw new Error(data.error?.message || 'Failed to create invitation');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resendInvitation = async (invitationId: number) => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/consultant/invitations/${invitationId}/resend`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invitation resent successfully"
        });
      } else {
        throw new Error(data.error?.message || 'Failed to resend invitation');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const cancelInvitation = async (invitationId: number) => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/consultant/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invitation cancelled successfully"
        });
        fetchInvitations(); // Refresh list
      } else {
        throw new Error(data.error?.message || 'Failed to cancel invitation');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'accepted':
        return <Badge variant="default">Accepted</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isExpired = (expiresAt: string) => new Date() > new Date(expiresAt);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Producer Invitations</h3>
          <p className="text-sm text-gray-600">Manage invitations to potential clients</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Producer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Invite Producer</DialogTitle>
              <DialogDescription>
                Send an invitation to a cattle producer to work with you on CattleNutrition Pro.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="producerEmail">Producer Email *</Label>
                <Input
                  id="producerEmail"
                  type="email"
                  value={formData.producerEmail}
                  onChange={(e) => setFormData({ ...formData, producerEmail: e.target.value })}
                  placeholder="producer@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="producerName">Producer Name *</Label>
                <Input
                  id="producerName"
                  value={formData.producerName}
                  onChange={(e) => setFormData({ ...formData, producerName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">Personal Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="I would like to help you manage your cattle nutrition program..."
                  rows={3}
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500">{formData.message.length}/1000 characters</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createInvitation} 
                disabled={loading || !formData.producerEmail || !formData.producerName}
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Invitations</CardTitle>
          <CardDescription>
            Track the status of invitations you've sent to producers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-400" />
              <p className="text-gray-500 mt-2">Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">No invitations sent yet</p>
              <p className="text-sm text-gray-400">Send your first invitation to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div 
                  key={invitation.id} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium">{invitation.producerName}</h4>
                        {getStatusBadge(invitation.status)}
                        {isExpired(invitation.expiresAt) && invitation.status === 'pending' && (
                          <Badge variant="outline" className="text-red-600">Expired</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{invitation.producerEmail}</p>
                      
                      {invitation.message && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageCircle className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 font-medium">Message:</span>
                          </div>
                          <p className="text-gray-600 italic">"{invitation.message}"</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Sent: {new Date(invitation.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                        </div>
                        {invitation.acceptedAt && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Calendar className="w-3 h-3" />
                            <span>Accepted: {new Date(invitation.acceptedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {invitation.declinedAt && (
                          <div className="flex items-center gap-1 text-red-600">
                            <Calendar className="w-3 h-3" />
                            <span>Declined: {new Date(invitation.declinedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {invitation.status === 'pending' && !isExpired(invitation.expiresAt) && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => resendInvitation(invitation.id)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Resend
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => cancelInvitation(invitation.id)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};