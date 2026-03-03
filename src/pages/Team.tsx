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
import { Plus, Users, Mail, Loader2, Copy, Check, ShieldOff, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import type { Profile, AppRole } from '@/lib/types';

const OTP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateOTP(): string {
  return Array.from({ length: 8 }, () =>
    OTP_CHARS[Math.floor(Math.random() * OTP_CHARS.length)]
  ).join('');
}

interface TeamMember extends Profile {
  role?: AppRole;
}

export default function Team() {
  const navigate = useNavigate();
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | null>(null);
  const [suspendedUsers, setSuspendedUsers] = useState<Set<string>>(new Set());
  const [suspendingUser, setSuspendingUser] = useState<string | null>(null);

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState(() => generateOTP());
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'team' | 'client'>('team');
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

      // Load actual ban statuses from auth backend
      const memberIds = membersWithRoles.map(m => m.user_id).filter(Boolean);
      if (memberIds.length > 0) {
        try {
          const { data: statusData } = await supabase.functions.invoke('manage-user', {
            body: { action: 'get_statuses', userIds: memberIds },
          });
          if (statusData?.statuses) {
            const suspended = new Set<string>(
              Object.entries(statusData.statuses as Record<string, boolean>)
                .filter(([, isBanned]) => isBanned)
                .map(([uid]) => uid)
            );
            setSuspendedUsers(suspended);
          }
        } catch (e) {
          console.error('Failed to fetch ban statuses:', e);
        }
      }
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

  const logActivity = async (actionType: string, targetName: string, details: Record<string, any> = {}) => {
    try {
      const { error } = await (supabase.from as any)('activity_log').insert({
        action_type: actionType,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || 'Unknown',
        target_name: targetName,
        details,
      });
      if (error) console.error('Activity log insert error:', error);
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newFullName) {
      toast({ title: 'Missing fields', description: 'Please fill in email and full name.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    setCreatedCredentials(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newEmail, password: otp, fullName: newFullName, role: newRole },
      });

      if (error) {
        let message = 'Failed to create user.';
        try {
          const body = await (error as any).context?.json?.();
          message = body?.error || error.message || message;
        } catch {
          message = error.message || message;
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      setCreatedCredentials({ email: newEmail, password: otp });
      toast({ title: 'User created', description: `${newEmail} has been added as ${newRole}.` });
      logActivity('user_created', newFullName, { email: newEmail, role: newRole });

      fetchTeamMembers();
      setNewEmail('');
      setNewFullName('');
      setNewRole('team');
      setOtp(generateOTP());
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast({ title: 'Error', description: err.message || 'Failed to create user.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignRole = async (userId: string, newRoleValue: AppRole) => {
    const targetMember = members.find(m => m.user_id === userId);
    const oldRole = targetMember?.role;
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
      logActivity('role_changed', targetMember?.full_name || userId, { from_role: oldRole, to_role: newRoleValue });

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

  const copyToClipboard = async (text: string, field: 'email' | 'password' | 'both') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyBoth = () => {
    if (!createdCredentials) return;
    copyToClipboard(
      `Email: ${createdCredentials.email}\nOne-Time Password: ${createdCredentials.password}`,
      'both'
    );
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
      logActivity(isSuspended ? 'user_reactivated' : 'user_suspended', member.full_name);
    } catch (error: unknown) {
      let message = 'Failed to update user status.';
      try {
        const body = await (error as any).context?.json?.();
        message = body?.error || (error instanceof Error ? error.message : message);
      } catch {
        message = error instanceof Error ? error.message : message;
      }
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSuspendingUser(null);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setCreatedCredentials(null);
    setNewEmail('');
    setNewFullName('');
    setNewRole('team');
    setOtp(generateOTP());
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
                      Share these credentials with the user. The one-time password must be reset on first login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                      <p className="mb-3 text-sm font-semibold text-green-800 dark:text-green-300">
                        User created — share these credentials:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-md border border-green-200 bg-white px-3 py-2 dark:border-green-800 dark:bg-green-950/50">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</p>
                            <p className="font-mono text-sm">{createdCredentials.email}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                            onClick={() => copyToClipboard(createdCredentials!.email, 'email')}>
                            {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-green-200 bg-white px-3 py-2 dark:border-green-800 dark:bg-green-950/50">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">One-Time Password</p>
                            <p className="font-mono text-sm tracking-widest">{createdCredentials.password}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                            onClick={() => copyToClipboard(createdCredentials!.password, 'password')}>
                            {copiedField === 'password' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm"
                        className="mt-3 w-full border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
                        onClick={copyBoth}>
                        {copiedField === 'both' ? <><Check className="mr-2 h-3.5 w-3.5" />Copied!</> : <><Copy className="mr-2 h-3.5 w-3.5" />Copy Both</>}
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={closeDialog}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Add a team member or client. A one-time password will be generated — the user must reset it on first login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new_email">Email</Label>
                        <Input
                          id="new_email"
                          type="email"
                          placeholder="user@example.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_full_name">Full Name</Label>
                        <Input
                          id="new_full_name"
                          placeholder="Jane Smith"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['team', 'client'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setNewRole(r)}
                            disabled={isSubmitting}
                            className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                              newRole === r
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <span className="font-medium capitalize">{r}</span>
                            <span className="text-xs text-muted-foreground">
                              {r === 'team' ? 'Full access to orders & production' : 'Client portal access only'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5" />
                        One-Time Password
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input value={otp} readOnly className="font-mono tracking-widest" />
                        <Button type="button" variant="outline" size="icon"
                          onClick={() => setOtp(generateOTP())} disabled={isSubmitting} title="Regenerate password">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Auto-generated. The user will be required to set a new password on first login.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create User'}
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
