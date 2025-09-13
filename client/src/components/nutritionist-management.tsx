import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, User, UserCheck, Plus, Mail, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { StaffMember, InviteStaffForm } from "@shared/schema";
import { inviteStaffSchema } from "@shared/schema";
import { useUserAuth, hasPermission } from "@/hooks/use-user-auth";

interface NutritionistManagementProps {
  operatorEmail: string;
  operationId: number;
}

export default function NutritionistManagement({ operatorEmail, operationId }: NutritionistManagementProps) {
  const { toast } = useToast();
  const { role } = useUserAuth();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Fetch consultants using new system
  const { data: consultants = [], isLoading } = useQuery({
    queryKey: ["/api/producer/consultants", operationId],
    enabled: !!operationId,
    select: (data: any) => data.relationships || [],
  });

  // Fetch staff members
  const { data: staffMembers = [], isLoading: isStaffLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff", operationId],
    enabled: !!operationId,
  });

  // Staff invitation form
  const inviteForm = useForm<InviteStaffForm>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
    },
  });

  // Staff invitation mutation
  const inviteStaffMutation = useMutation({
    mutationFn: async (formData: InviteStaffForm) => {
      return await apiRequest('POST', '/api/staff/invite', { ...formData, operatorEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', operatorEmail] });
      toast({
        title: 'Invitation sent!',
        description: 'Staff member has been invited to join your operation.',
      });
      inviteForm.reset();
      setIsInviteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send invitation',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });


  if (isLoading || isStaffLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">
          Loading team information...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staff Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Staff Members
              </h2>
              <p className="text-sm text-gray-600">Team members who can perform pen actions and record feedings</p>
            </div>
            {hasPermission(role, 'invite_staff') && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center space-x-1">
                    <Plus className="h-4 w-4" />
                    <span>Invite Staff</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={inviteForm.handleSubmit((data) => inviteStaffMutation.mutate(data))} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="staff@example.com"
                        {...inviteForm.register('email')}
                      />
                      {inviteForm.formState.errors.email && (
                        <p className="text-sm text-red-600">
                          {inviteForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        {...inviteForm.register('firstName')}
                      />
                      {inviteForm.formState.errors.firstName && (
                        <p className="text-sm text-red-600">
                          {inviteForm.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        {...inviteForm.register('lastName')}
                      />
                      {inviteForm.formState.errors.lastName && (
                        <p className="text-sm text-red-600">
                          {inviteForm.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                    <div className="bg-blue-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium text-blue-900 mb-1">Staff Permissions</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Record cattle feeding</li>
                        <li>• Update pen weights</li>
                        <li>• Record death loss and treatments</li>
                        <li>• View all operation data</li>
                      </ul>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsInviteDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={inviteStaffMutation.isPending}
                      >
                        {inviteStaffMutation.isPending ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="p-4">
          {staffMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No staff members yet</p>
              {hasPermission(role, 'invite_staff') ? (
                <p className="text-sm text-gray-400">
                  Invite team members to help manage your operation
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Only the operation owner can invite staff members
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 w-full min-w-0">
              {staffMembers.map((staff) => (
                <Card key={staff.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        staff.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm">
                          {staff.firstName} {staff.lastName}
                        </CardTitle>
                        <CardDescription className="text-xs truncate">
                          {staff.email}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {staff.status === 'active' && staff.acceptedAt && (
                    <CardContent className="pt-0 pb-3">
                      <p className="text-xs text-gray-500">
                        Joined {new Date(staff.acceptedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  )}
                  {staff.status === 'invited' && (
                    <CardContent className="pt-0 pb-3">
                      <p className="text-xs text-gray-500">
                        Invited {new Date(staff.invitedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Consultants Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Consultants
              </h2>
              <p className="text-sm text-gray-600">Professional consultants working with your operation</p>
            </div>
          </div>
        </div>

        <div className="p-4">

          {consultants.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No consultants yet</p>
              <p className="text-sm text-gray-400">
                Consultants who invite you will appear here once you accept their invitation
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 w-full min-w-0">
              {consultants.map((relationship: any) => (
                <Card key={relationship.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm">
                          {relationship.consultant.fullName || relationship.consultant.username}
                        </CardTitle>
                        <CardDescription className="text-xs truncate">
                          {relationship.consultant.email}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {relationship.consultant.specialization || 'Consultant'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Status:</span>
                      <Badge variant={relationship.status === 'active' ? 'default' : 'secondary'}>
                        {relationship.status}
                      </Badge>
                    </div>
                    {relationship.establishedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Connected {new Date(relationship.establishedAt).toLocaleDateString()}
                      </p>
                    )}
                    {relationship.permissions && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {relationship.permissions.view && (
                          <Badge variant="outline" className="text-xs">View</Badge>
                        )}
                        {relationship.permissions.edit && (
                          <Badge variant="outline" className="text-xs">Edit</Badge>
                        )}
                        {relationship.permissions.admin && (
                          <Badge variant="outline" className="text-xs">Admin</Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Veterinarians Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold flex items-center">
            <UserCheck className="h-5 w-5 mr-2" />
            Veterinarians
          </h2>
          <p className="text-sm text-gray-600">Healthcare professionals for your operation</p>
        </div>

        <div className="p-4">
          {/* Mock Veterinarian Card */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold text-green-900">Dr. Sarah Mitchell</h3>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-green-700 font-medium">Rocky Mountain Veterinary Services</p>
                <p className="text-sm text-green-600 mt-1">Large Animal Specialist</p>
                
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-white text-green-700 rounded border border-green-200">
                    Cattle Health
                  </span>
                  <span className="px-2 py-1 bg-white text-green-700 rounded border border-green-200">
                    Vaccination Programs
                  </span>
                  <span className="px-2 py-1 bg-white text-green-700 rounded border border-green-200">
                    Emergency Care
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">Last Visit:</span>
                    <span className="font-medium text-green-800">Dec 15, 2024</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-green-600">Next Scheduled:</span>
                    <span className="font-medium text-green-800">Jan 20, 2025</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Veterinarian Button */}
          <div className="mt-4">
            <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
              <Plus className="h-5 w-5 mx-auto mb-1" />
              <span className="text-sm font-medium">Add Veterinarian</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}