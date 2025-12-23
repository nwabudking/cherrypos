import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface InviteStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteStaffDialog = ({ open, onOpenChange }: InviteStaffDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const signupUrl = `${window.location.origin}/auth`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(signupUrl);
    setCopied(true);
    toast({
      title: "Link Copied",
      description: "Share this link with new staff members to sign up.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite New Staff</DialogTitle>
          <DialogDescription>
            Share the signup link with new team members. They will be assigned the default "Cashier" role upon registration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Signup Link</p>
            <div className="flex gap-2">
              <code className="flex-1 p-3 rounded-lg bg-muted text-sm break-all">
                {signupUrl}
              </code>
              <Button variant="outline" size="icon" onClick={copyLink}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> After a staff member signs up, you can change their role from the staff list. Only Super Admins can modify roles.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
