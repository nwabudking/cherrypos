import { useAuth } from "@/contexts/AuthContext";
import { useStaffAuth } from "@/contexts/StaffAuthContext";
import { useCashierAssignment } from "./useCashierAssignment";

/**
 * Hook to get effective user info regardless of auth type (Supabase or local staff)
 */
export function useEffectiveUser() {
  const { user, role: authRole, profile } = useAuth();
  const { staffUser, isStaffAuthenticated } = useStaffAuth();

  // Determine effective user ID and role
  const effectiveUserId = isStaffAuthenticated ? staffUser?.id : user?.id;
  const effectiveRole = isStaffAuthenticated ? staffUser?.role : authRole;
  const effectiveName = isStaffAuthenticated 
    ? staffUser?.full_name 
    : profile?.full_name || user?.email;
  const isLocalStaff = isStaffAuthenticated;

  // Check if user is admin-level
  const isAdmin = effectiveRole === "super_admin" || 
                  effectiveRole === "manager" || 
                  effectiveRole === "store_admin";
  
  const isCashier = effectiveRole === "cashier";
  const isWaitstaff = effectiveRole === "waitstaff";

  // Get bar assignment - pass correct flag for staff users
  const { data: assignment, isLoading: assignmentLoading } = useCashierAssignment(
    effectiveUserId || "",
    isLocalStaff
  );

  return {
    userId: effectiveUserId,
    role: effectiveRole,
    name: effectiveName,
    isLocalStaff,
    isAdmin,
    isCashier,
    isWaitstaff,
    assignment,
    assignmentLoading,
    barId: assignment?.bar_id,
    barName: assignment?.bar?.name,
    // Expose staff user ID separately for RPC calls that need it
    staffUserId: isLocalStaff ? staffUser?.id : undefined,
  };
}
