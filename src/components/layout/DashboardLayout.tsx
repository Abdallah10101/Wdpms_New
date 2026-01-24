import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  UserPlus,
  Truck,
  Calculator,
  FolderArchive,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles: ('admin' | 'team' | 'client')[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'My Portal',
    href: '/portal',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: <Package className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'My Files',
    href: '/files',
    icon: <FolderArchive className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Client Files',
    href: '/files',
    icon: <FolderArchive className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Leads',
    href: '/leads',
    icon: <UserPlus className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Suppliers',
    href: '/suppliers',
    icon: <Truck className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Team',
    href: '/team',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'WDS Calculator',
    href: '/calculator',
    icon: <Calculator className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin'],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar-background transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">WorkDuShop</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {item.icon}
                {item.label}
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {role || 'Loading...'}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          {/* Notification bell for clients */}
          {role === 'client' && <NotificationBell />}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
