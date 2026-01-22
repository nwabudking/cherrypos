import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useStaffAuth } from '@/contexts/StaffAuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  History,
  Wine,
  ChefHat,
  Truck,
  Users,
  Heart,
  BarChart3,
  Settings,
  Cherry,
  DatabaseBackup,
  FileText,
  Warehouse,
  Store,
  Package,
  ArrowRightLeft,
} from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: AppRole[];
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'manager', 'cashier', 'bar_staff', 'kitchen_staff', 'inventory_officer', 'accountant', 'store_user', 'store_admin'] },
  { title: 'POS', url: '/pos', icon: ShoppingCart, roles: ['super_admin', 'manager', 'cashier', 'waitstaff'] },
  { title: 'Orders', url: '/orders', icon: ClipboardList, roles: ['super_admin', 'manager', 'cashier', 'bar_staff', 'kitchen_staff'] },
  { title: 'Order History', url: '/order-history', icon: History, roles: ['super_admin', 'manager', 'cashier'] },
  { title: 'EOD Report', url: '/eod-report', icon: FileText, roles: ['super_admin', 'manager', 'cashier'] },
];

const operationsNavItems: NavItem[] = [
  { title: 'Bar', url: '/bar', icon: Wine, roles: ['super_admin', 'manager', 'bar_staff', 'cashier'] },
  { title: 'Kitchen', url: '/kitchen', icon: ChefHat, roles: ['super_admin', 'manager', 'kitchen_staff'] },
  { title: 'Bar Inventory', url: '/bar-inventory', icon: Package, roles: ['cashier'] },
  { title: 'Transfers', url: '/transfers', icon: ArrowRightLeft, roles: ['super_admin', 'manager', 'cashier', 'store_admin', 'waitstaff'] },
];

const storeNavItems: NavItem[] = [
  { title: 'Store Management', url: '/store', icon: Warehouse, roles: ['super_admin', 'manager', 'store_admin', 'store_user', 'inventory_officer'] },
  { title: 'Bars', url: '/bars', icon: Store, roles: ['super_admin', 'manager'] },
];

const managementNavItems: NavItem[] = [
  { title: 'Suppliers', url: '/inventory', icon: Truck, roles: ['super_admin', 'manager', 'inventory_officer'] },
  { title: 'Staff', url: '/staff', icon: Users, roles: ['super_admin', 'manager'] },
  { title: 'Customers', url: '/customers', icon: Heart, roles: ['super_admin', 'manager', 'cashier'] },
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['super_admin', 'manager', 'accountant'] },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['super_admin', 'manager'] },
  { title: 'Migration', url: '/migration', icon: DatabaseBackup, roles: ['super_admin'] },
];

export const AppSidebar = () => {
  const { role: authRole } = useAuth();
  const { staffUser, isStaffAuthenticated } = useStaffAuth();
  const location = useLocation();

  // Use staff role if staff authenticated, otherwise use Supabase auth role
  const effectiveRole = isStaffAuthenticated ? staffUser?.role : authRole;

  const filterByRole = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      if (!effectiveRole) return false;
      return item.roles.includes(effectiveRole as AppRole);
    });
  };

  const isActive = (path: string) => location.pathname === path;

  const renderNavItems = (items: NavItem[]) => {
    const filteredItems = filterByRole(items);
    return filteredItems.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink
            to={item.url}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
            activeClassName="bg-primary/10 text-primary border-l-2 border-primary"
          >
            <item.icon className="w-5 h-5" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-cherry rounded-xl flex items-center justify-center glow-cherry-sm">
            <Cherry className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg">Cherry</h1>
            <p className="text-xs text-muted-foreground">Dining Lounge</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(mainNavItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(operationsNavItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Store
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(storeNavItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(managementNavItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} Cherry Dining
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
