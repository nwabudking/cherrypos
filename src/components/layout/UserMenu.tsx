import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Settings, Key, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StaffChangePasswordDialog } from '@/components/staff/StaffChangePasswordDialog';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  bar_staff: 'Bar Staff',
  kitchen_staff: 'Kitchen Staff',
  inventory_officer: 'Inventory Officer',
  accountant: 'Accountant',
  store_admin: 'Store Admin',
  store_user: 'Store User',
  waitstaff: 'Waitstaff',
};

export const UserMenu = () => {
  const { user, profile, signOut } = useAuth();
  const { staffUser, isStaffAuthenticated, staffLogout } = useStaffAuth();
  const { barName, role: effectiveRole, isLocalStaff } = useEffectiveUser();
  const navigate = useNavigate();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const handleSignOut = async () => {
    if (isStaffAuthenticated) {
      staffLogout();
      navigate('/staff-login');
    } else {
      await signOut();
      navigate('/auth');
    }
  };

  // Determine display values based on auth type
  const displayName = isStaffAuthenticated 
    ? staffUser?.full_name 
    : profile?.full_name || user?.email || 'User';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-3 px-2 hover:bg-muted">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={!isStaffAuthenticated ? profile?.avatar_url || undefined : undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium text-foreground">
                {displayName}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {effectiveRole ? roleLabels[effectiveRole] || effectiveRole : 'Staff'}
                </span>
                {barName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                    <Store className="h-2.5 w-2.5" />
                    {barName}
                  </Badge>
                )}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
          <DropdownMenuLabel className="text-foreground">
            <div className="flex flex-col">
              <span>My Account</span>
              {barName && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 mt-1">
                  <Store className="h-3 w-3" />
                  Assigned to: {barName}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem className="text-foreground hover:bg-muted cursor-pointer">
            <User className="w-4 h-4 mr-2" />
            Profile
          </DropdownMenuItem>
          {isLocalStaff && (
            <DropdownMenuItem 
              className="text-foreground hover:bg-muted cursor-pointer"
              onClick={() => setPasswordDialogOpen(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </DropdownMenuItem>
          )}
          {!isStaffAuthenticated && (
            <DropdownMenuItem 
              className="text-foreground hover:bg-muted cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isLocalStaff && staffUser && (
        <StaffChangePasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          staffId={staffUser.id}
          staffName={staffUser.full_name}
        />
      )}
    </>
  );
};
