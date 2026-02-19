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
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  UserPlus,
  Truck,
  Calculator,
  FileText,
  BarChart3,
  History,
  Search,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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
    label: 'Dashboard',
    href: '/portal?tab=dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Active Orders',
    href: '/portal?tab=active',
    icon: <Package className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Completed',
    href: '/portal?tab=completed',
    icon: <ChevronRight className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Invoices',
    href: '/portal?tab=invoices',
    icon: <FileText className="h-5 w-5" />,
    roles: ['client'],
  },
  {
    label: 'Updates',
    href: '/portal?tab=updates',
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
    label: 'Invoices',
    href: '/invoices',
    icon: <FileText className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Audit Log',
    href: '/audit-log',
    icon: <History className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin', 'team'],
  },
];

interface SearchResult {
  type: 'order' | 'client' | 'lead' | 'invoice';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results: SearchResult[] = [];
      const [ordersRes, clientsRes, leadsRes, invoicesRes] = await Promise.all([
        supabase.from('orders').select('id, order_number, product_name').or(`order_number.ilike.%${q}%,product_name.ilike.%${q}%`).limit(5),
        supabase.from('clients').select('id, name, brand_name').or(`name.ilike.%${q}%,brand_name.ilike.%${q}%`).limit(5),
        (supabase.from('leads' as any) as any).select('id, company_name, contact_name').or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`).limit(5),
        supabase.from('invoices').select('id, invoice_number, order_name').or(`invoice_number.ilike.%${q}%,order_name.ilike.%${q}%`).limit(5),
      ]);
      (ordersRes.data || []).forEach((o: any) => results.push({ type: 'order', id: o.id, title: o.order_number, subtitle: o.product_name, href: `/orders/${o.id}` }));
      (clientsRes.data || []).forEach((c: any) => results.push({ type: 'client', id: c.id, title: c.brand_name || c.name, subtitle: c.brand_name ? c.name : undefined, href: `/clients/${c.id}` }));
      (leadsRes.data || []).forEach((l: any) => results.push({ type: 'lead', id: l.id, title: l.company_name, subtitle: l.contact_name, href: '/leads' }));
      (invoicesRes.data || []).forEach((i: any) => results.push({ type: 'invoice', id: i.id, title: i.invoice_number, subtitle: i.order_name, href: '/invoices' }));
      setSearchResults(results);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0',
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
            const isActive = item.href.includes('?tab=')
              ? location.pathname + location.search === item.href
              : location.pathname === item.href;
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
      <div className="flex flex-1 flex-col overflow-hidden relative z-0">
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
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {/* Global Search */}
            {role !== 'client' && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(true); setSearchQuery(''); setSearchResults([]); }} title="Search (orders, clients, leads, invoices)">
                <Search className="h-5 w-5" />
              </Button>
            )}
            {/* Notification bell for all roles */}
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* Global Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Global Search
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search orders, clients, leads, invoices..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            {isSearching && <p className="text-sm text-muted-foreground text-center py-2">Searching...</p>}
            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No results found</p>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                    onClick={() => { navigate(result.href); setSearchOpen(false); }}
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      result.type === 'order' ? 'bg-blue-100 text-blue-700' :
                      result.type === 'client' ? 'bg-green-100 text-green-700' :
                      result.type === 'lead' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {result.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.subtitle && <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
