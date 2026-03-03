import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, User, UserPlus, RefreshCw, Copy, Check, KeyRound, Lock } from 'lucide-react';

const OTP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOTP(): string {
  return Array.from({ length: 8 }, () =>
    OTP_CHARS[Math.floor(Math.random() * OTP_CHARS.length)]
  ).join('');
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, role, isLoading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  // Profile form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '' });

  // Change password form
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Create user form (admin only)
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'team' | 'client'>('team');
  const [otp, setOtp] = useState(() => generateOTP());
  const [isCreating, setIsCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    // Only block clients — team and admin can access Settings
    if (!authLoading && role === 'client') navigate('/dashboard');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({ full_name: profile.full_name || '', phone: profile.phone || '' });
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name, phone: formData.phone || null })
        .eq('user_id', user?.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Success', description: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwData.currentPassword) {
      toast({ title: 'Required', description: 'Please enter your current password.', variant: 'destructive' });
      return;
    }
    if (pwData.newPassword.length < 8) {
      toast({ title: 'Too short', description: 'New password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (pwData.newPassword !== pwData.confirmPassword) {
      toast({ title: 'Mismatch', description: 'New passwords do not match.', variant: 'destructive' });
      return;
    }
    if (pwData.currentPassword === pwData.newPassword) {
      toast({ title: 'Same password', description: 'New password must be different from your current one.', variant: 'destructive' });
      return;
    }
    setIsChangingPw(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: pwData.currentPassword,
      });
      if (signInError) {
        toast({ title: 'Incorrect password', description: 'Your current password is wrong. Please try again.', variant: 'destructive' });
        return;
      }

      // Current password verified — update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: pwData.newPassword });
      if (updateError) throw updateError;

      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
    } catch (err: any) {
      console.error('Error changing password:', err);
      toast({ title: 'Error', description: err.message || 'Failed to update password.', variant: 'destructive' });
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserFullName) {
      toast({ title: 'Missing fields', description: 'Please fill in email and full name.', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    setCreatedCredentials(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newUserEmail, password: otp, fullName: newUserFullName, role: newUserRole },
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

      setCreatedCredentials({ email: newUserEmail, password: otp });
      toast({ title: 'User created', description: `${newUserEmail} has been added as ${newUserRole}.` });

      setNewUserEmail('');
      setNewUserFullName('');
      setNewUserRole('team');
      setOtp(generateOTP());
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast({ title: 'Error', description: err.message || 'Failed to create user.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
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

  if (authLoading || !user || role === 'client') return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Profile Settings */}
        <form onSubmit={handleSaveProfile}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={profile?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Save Changes</>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Change Password */}
        <form onSubmit={handleChangePassword}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Set a new password for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  placeholder="Enter your current password"
                  value={pwData.currentPassword}
                  onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
                  required
                  disabled={isChangingPw}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={pwData.newPassword}
                  onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
                  required
                  disabled={isChangingPw}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Repeat new password"
                  value={pwData.confirmPassword}
                  onChange={(e) => setPwData({ ...pwData, confirmPassword: e.target.value })}
                  required
                  disabled={isChangingPw}
                />
              </div>
              <Button type="submit" disabled={isChangingPw}>
                {isChangingPw ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" />Update Password</>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Create New User — admin only */}
        {role === 'admin' && (
          <form onSubmit={handleCreateUser}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Create New User
                </CardTitle>
                <CardDescription>
                  Add a team member or client. A one-time password will be generated — the user must reset it on first login.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new_email">Email</Label>
                    <Input
                      id="new_email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                      disabled={isCreating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_full_name">Full Name</Label>
                    <Input
                      id="new_full_name"
                      placeholder="Jane Smith"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      required
                      disabled={isCreating}
                    />
                  </div>
                </div>

                {/* Role Selector */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['team', 'client'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewUserRole(r)}
                        disabled={isCreating}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                          newUserRole === r
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

                {/* Generated OTP */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    One-Time Password
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input value={otp} readOnly className="font-mono tracking-widest" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setOtp(generateOTP())}
                      disabled={isCreating}
                      title="Regenerate password"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-generated. The user will be required to set a new password on first login.
                  </p>
                </div>

                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating User...</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" />Create User</>
                  )}
                </Button>

                {/* Success: credentials to share */}
                {createdCredentials && (
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                        >
                          {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-green-200 bg-white px-3 py-2 dark:border-green-800 dark:bg-green-950/50">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">One-Time Password</p>
                          <p className="font-mono text-sm tracking-widest">{createdCredentials.password}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                        >
                          {copiedField === 'password' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
                      onClick={copyBoth}
                    >
                      {copiedField === 'both' ? (
                        <><Check className="mr-2 h-3.5 w-3.5" />Copied!</>
                      ) : (
                        <><Copy className="mr-2 h-3.5 w-3.5" />Copy Both</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        )}

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="capitalize">{role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member Since</span>
              <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB') : 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
