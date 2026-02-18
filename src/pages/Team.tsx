import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Users, Mail, Loader2, Copy, Check, ShieldOff, ShieldCheck } from 'lucide-react';
import type { Profile, AppRole } from '@/lib/types';

interface TeamMember extends Profile {
  role?: AppRole;
}

export default function Team() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suspendedUsers, setSuspendedUsers] = useState<Set<string>>(new Set());
  const [suspendingUser, setSuspendingUser] = useState<string | null>(null);

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('client');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role === 'admin') {
      fetchTeamMembers();
    }
  }, [user, role]);

  const fetchTeamMembers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const membersWithRoles: TeamMember[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...(profile as Profile),
          role: userRole?.role as AppRole | undefined,
        };
      });

      setMembers(membersWithRoles);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load team members.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          role: newRole,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Store credentials for display
      setCreatedCredentials({ email: newEmail, password: newPassword });

      toast({
        title: 'User Created!',
        description: `${newFullName} has been added as ${newRole}.`,
      });

      // Refresh the list
      fetchTeamMembers();

      // Reset form but keep dialog open to show credentials
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('client');
    } catch (error: unknown) {
      console.error('Error creating user:', error);
      const message = error instanceof Error ? error.message : 'Failed to create user.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignRole = async (userId: string, newRoleValue: AppRole) => {
    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRoleValue })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRoleValue });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Role updated successfully.',
      });

      fetchTeamMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role.',
        variant: 'destructive',
      });
    }
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Credentials copied to clipboard.',
      });
    }
  };

  const handleToggleSuspend = async (member: TeamMember) => {
    const isSuspended = suspendedUsers.has(member.user_id);
    setSuspendingUser(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: isSuspended ? 'unban' : 'ban', userId: member.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuspendedUsers(prev => {
        const next = new Set(prev);
        if (isSuspended) next.delete(member.user_id);
        else next.add(member.user_id);
        return next;
      });

      toast({
        title: isSuspended ? 'User Reactivated' : 'User Suspended',
        description: isSuspended
          ? `${member.full_name} can now log in again.`
          : `${member.full_name} has been suspended and cannot log in.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user status.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSuspendingUser(null);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setCreatedCredentials(null);
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('client');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (roleValue?: AppRole) => {
    switch (roleValue) {
      case 'admin':
        return 'bg-primary text-primary-foreground';
      case 'team':
        return 'bg-blue-500 text-white';
      case 'client':
        return 'bg-green-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (authLoading || !user || role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">
              Manage team members and their roles
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) closeDialog();
            else setIsDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {createdCredentials ? (
                <>
                  <DialogHeader>
                    <DialogTitle>User Created Successfully!</DialogTitle>
                    <DialogDescription>
                      Share these credentials with the user. Make sure to save them as the password cannot be retrieved later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="font-mono text-sm">{createdCredentials.email}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Password</Label>
                        <p className="font-mono text-sm">{createdCredentials.password}</p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={copyCredentials}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy Credentials'}
                    </Button>
                    <Button onClick={closeDialog}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Create an account for a team member or client. They can use these credentials to log in.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground">
                        Create a temporary password. Users can change it after logging in.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newRole}
                        onValueChange={(value) => setNewRole(value as AppRole)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>All Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? 's' : ''} in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No team members yet</p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First User
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={member.role || 'none'}
                        onValueChange={(value) =>
                          handleAssignRole(member.user_id, value as AppRole)
                        }
                        disabled={suspendedUsers.has(member.user_id)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Set role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                      {member.user_id !== user?.id && (
                        <Button
                          variant={suspendedUsers.has(member.user_id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleSuspend(member)}
                          disabled={suspendingUser === member.user_id}
                          title={suspendedUsers.has(member.user_id) ? 'Reactivate user' : 'Suspend user'}
                        >
                          {suspendingUser === member.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : suspendedUsers.has(member.user_id) ? (
                            <><ShieldCheck className="h-4 w-4 mr-1" />Reactivate</>
                          ) : (
                            <><ShieldOff className="h-4 w-4 mr-1" />Suspend</>
                          )}
                        </Button>
                      )}
                      {suspendedUsers.has(member.user_id) && (
                        <Badge className="bg-red-100 text-red-700 text-xs">Suspended</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>Understanding what each role can do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Badge className={getRoleBadgeColor('admin')}>Admin</Badge>
              <p className="text-sm text-muted-foreground">
                Full access to all features. Can create clients, orders, manage team, and see analytics.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className={getRoleBadgeColor('team')}>Team</Badge>
              <p className="text-sm text-muted-foreground">
                Can view and update assigned orders, complete tasks, upload files, and add internal comments.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className={getRoleBadgeColor('client')}>Client</Badge>
              <p className="text-sm text-muted-foreground">
                Can view their own orders, production timeline, and download client-visible files.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
