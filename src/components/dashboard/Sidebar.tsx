import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  CheckCircle, 
  Receipt, 
  Building2, 
  BarChart3, 
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  FileUp,
  ClipboardList,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePlan } from '@/hooks/usePlan';
import { PlanType, PLAN_NAMES } from '@/lib/planConfig';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'review';
  requiredFeature?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Belege hochladen', href: '/upload', icon: Upload },
  { name: 'Review', href: '/review', icon: CheckCircle, badgeKey: 'review' },
  { name: 'Alle Ausgaben', href: '/expenses', icon: Receipt },
  { name: 'Kontoabgleich', href: '/reconciliation', icon: Building2, requiredFeature: 'reconciliation' },
  { name: 'Konto-Import', href: '/bank-import', icon: FileUp, requiredFeature: 'bankImport' },
  { name: 'Berichte', href: '/reports', icon: BarChart3 },
  { name: 'Checklisten', href: '/checklists', icon: ClipboardList },
  { name: 'Einstellungen', href: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [reviewCount, setReviewCount] = useState<number>(0);
  const {
    effectivePlan,
    isAdmin,
    adminViewPlan,
    receiptsUsed,
    receiptsCredit,
    receiptsLimit,
    receiptsAvailable,
    features,
    planName,
    setAdminViewPlan,
  } = usePlan();

  const fetchReviewCount = useCallback(async () => {
    if (!user) { setReviewCount(0); return; }
    const { count, error } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'review');
    if (!error && count !== null) setReviewCount(count);
  }, [user]);

  useEffect(() => {
    fetchReviewCount();
    const channel = supabase
      .channel('receipts-review-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, () => fetchReviewCount())
      .subscribe();
    const handleRefreshCount = () => fetchReviewCount();
    window.addEventListener('refresh-review-count', handleRefreshCount);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('refresh-review-count', handleRefreshCount);
    };
  }, [user, fetchReviewCount]);

  const getBadgeCount = (badgeKey?: string): number | null => {
    if (badgeKey === 'review') return reviewCount > 0 ? reviewCount : null;
    return null;
  };

  const isFeatureEnabled = (requiredFeature?: string): boolean => {
    if (!requiredFeature) return true;
    return (features as Record<string, boolean>)[requiredFeature] ?? true;
  };

  const usagePercent = receiptsLimit > 0 ? Math.min(100, (receiptsUsed / receiptsLimit) * 100) : 0;
  const quotaColor = usagePercent > 95 ? 'text-destructive' : usagePercent > 80 ? 'text-yellow-500' : 'text-primary';

  const userEmail = user?.email || 'user@example.com';
  const userName = user?.user_metadata?.first_name 
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
    : userEmail.split('@')[0];
  const userInitials = userName.slice(0, 2).toUpperCase();

  const filteredNavigation = navigation.filter(item => isFeatureEnabled(item.requiredFeature));

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-xl font-bold text-sidebar-foreground">XpenzAi</span>}
        </Link>
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          const badgeCount = getBadgeCount(item.badgeKey);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.name}</span>
                  {badgeCount !== null && (
                    <Badge variant="destructive" className="ml-auto h-auto min-w-5 px-1.5 py-0.5 flex items-center justify-center text-xs">
                      {badgeCount}
                    </Badge>
                  )}
                </>
              )}
              {collapsed && badgeCount !== null && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-auto min-w-4 px-1 py-0 flex items-center justify-center text-[10px]">
                  {badgeCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin Plan Switcher + Quota */}
      {!collapsed && (
        <div className="px-4 pb-2 space-y-3">
          {/* Admin Plan Switcher */}
          {isAdmin && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60">
                <Shield className="h-3 w-3" />
                <span>Admin-Vorschau</span>
              </div>
              <Select
                value={adminViewPlan || 'business'}
                onValueChange={(v) => setAdminViewPlan(v === 'business' && !adminViewPlan ? null : v as PlanType)}
              >
                <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['free', 'starter', 'pro', 'business'] as PlanType[]).map(p => (
                    <SelectItem key={p} value={p}>{PLAN_NAMES[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quota Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sidebar-foreground/60">Belege</span>
              <span className={cn('font-medium', quotaColor)}>
                {receiptsUsed} / {receiptsLimit}
              </span>
            </div>
            <Progress 
              value={usagePercent} 
              className="h-1.5"
            />
            {receiptsCredit > 0 && (
              <p className="text-[10px] text-sidebar-foreground/50">
                (+{receiptsCredit} Guthaben)
              </p>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-sidebar-foreground/50">{planName}-Plan</span>
              <span className="text-sidebar-foreground/50">{receiptsAvailable} verfügbar</span>
            </div>
          </div>
        </div>
      )}

      {/* User Menu */}
      <div className="p-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'flex items-center gap-3 w-full rounded-lg p-2 hover:bg-sidebar-accent transition-colors',
              collapsed && 'justify-center'
            )}>
              <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-medium text-sm flex-shrink-0">
                {userInitials}
              </div>
              {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">{userEmail}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Einstellungen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
