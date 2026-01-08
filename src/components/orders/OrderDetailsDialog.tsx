import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";
import type { OrderWithItems, OrderStatus } from "@/pages/Orders";

interface OrderDetailsDialogProps {
  order: OrderWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (status: OrderStatus, reason?: string) => void;
  isUpdating: boolean;
  userRole?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  preparing: { label: "Preparing", variant: "default" },
  ready: { label: "Ready", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const orderTypeLabels: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  bar_only: "Bar Only",
};

export const OrderDetailsDialog = ({
  order,
  open,
  onOpenChange,
  onUpdateStatus,
  isUpdating,
  userRole,
}: OrderDetailsDialogProps) => {
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (!order) return null;

  const status = statusConfig[order.status] || statusConfig.pending;
  const payment = order.payments?.[0];

  // Check if user can modify completed orders (only managers and admins)
  const canModifyCompleted = userRole === "super_admin" || userRole === "manager";
  const isCompleted = order.status === "completed" || order.status === "cancelled";
  const isCashier = userRole === "cashier";

  const statusActions: Record<string, { next: OrderStatus; label: string; requiresReason?: boolean }[]> = {
    pending: [
      { next: "preparing", label: "Start Preparing" },
      { next: "cancelled", label: "Cancel", requiresReason: true },
    ],
    preparing: [
      { next: "ready", label: "Mark Ready" },
      { next: "cancelled", label: "Cancel", requiresReason: true },
    ],
    ready: [
      { next: "completed", label: "Complete Order" },
      { next: "cancelled", label: "Cancel", requiresReason: true },
    ],
    completed: canModifyCompleted ? [
      { next: "cancelled", label: "Void Order", requiresReason: true },
    ] : [],
    cancelled: [],
  };

  const actions = statusActions[order.status] || [];

  const handleAction = (action: { next: OrderStatus; label: string; requiresReason?: boolean }) => {
    if (action.requiresReason) {
      setShowCancelReason(true);
    } else {
      onUpdateStatus(action.next);
    }
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) return;
    onUpdateStatus("cancelled", cancelReason);
    setShowCancelReason(false);
    setCancelReason("");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setShowCancelReason(false);
        setCancelReason("");
      }
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{order.order_number}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cashier restriction warning */}
          {isCashier && isCompleted && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Cashiers cannot modify completed orders. Contact a manager for corrections.
              </AlertDescription>
            </Alert>
          )}

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Order Type</p>
              <p className="font-medium">{orderTypeLabels[order.order_type]}</p>
            </div>
            {order.table_number && (
              <div>
                <p className="text-muted-foreground">Table</p>
                <p className="font-medium">{order.table_number}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {format(new Date(order.created_at!), "PPp")}
              </p>
            </div>
            {payment && (
              <div>
                <p className="text-muted-foreground">Payment</p>
                <p className="font-medium capitalize">{payment.payment_method}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Order Items */}
          <div>
            <h4 className="font-medium mb-3">Order Items</h4>
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">{item.quantity}x</span>
                    <span>{item.item_name}</span>
                    {item.notes && (
                      <span className="text-muted-foreground text-xs">
                        ({item.notes})
                      </span>
                    )}
                  </div>
                  <span>₦{item.total_price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₦{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT (7.5%)</span>
              <span>₦{order.vat_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Charge</span>
              <span>₦{order.service_charge.toLocaleString()}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-₦{order.discount_amount.toLocaleString()}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>₦{order.total_amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Cancel Reason Form */}
          {showCancelReason && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label htmlFor="cancel-reason">Reason for cancellation/void (required for audit)</Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="Enter the reason for this action..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCancelReason(false);
                      setCancelReason("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmCancel}
                    disabled={!cancelReason.trim() || isUpdating}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          {actions.length > 0 && !showCancelReason && (
            <>
              <Separator />
              <div className="flex gap-2 justify-end">
                {actions.map((action) => (
                  <Button
                    key={action.next}
                    variant={action.next === "cancelled" ? "destructive" : "default"}
                    onClick={() => handleAction(action)}
                    disabled={isUpdating}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
