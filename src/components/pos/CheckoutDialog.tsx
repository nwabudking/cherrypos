import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, CreditCard, Building2, Smartphone, Loader2 } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirmPayment: (method: string) => void;
  isProcessing: boolean;
}

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Banknote, color: "text-green-500" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-blue-500" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building2, color: "text-purple-500" },
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone, color: "text-orange-500" },
];

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

export const CheckoutDialog = ({
  open,
  onOpenChange,
  total,
  onConfirmPayment,
  isProcessing,
}: CheckoutDialogProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedMethod) {
      onConfirmPayment(selectedMethod);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Complete Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center py-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold text-primary">{formatPrice(total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {paymentMethods.map(({ id, label, icon: Icon, color }) => (
              <Card
                key={id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedMethod === id
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedMethod(id)}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <Icon className={`h-8 w-8 ${color}`} />
                  <span className="font-medium text-sm">{label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!selectedMethod || isProcessing}
            onClick={handleConfirm}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Payment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
