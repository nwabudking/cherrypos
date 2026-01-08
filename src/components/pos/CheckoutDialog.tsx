import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, CreditCard, Building2, Smartphone, Loader2, Printer, Check } from "lucide-react";
import { Receipt } from "./Receipt";
import type { CartItem } from "@/pages/POS";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  subtotal: number;
  cart: CartItem[];
  orderType: string;
  tableNumber: string;
  onConfirmPayment: (method: string) => void;
  isProcessing: boolean;
  completedOrder: { order_number: string } | null;
  onClose: () => void;
  cashierName?: string;
  canReprint?: boolean;
  insufficientStock?: Array<{ name: string; available: number; requested: number }>;
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
  subtotal,
  cart,
  orderType,
  tableNumber,
  onConfirmPayment,
  isProcessing,
  completedOrder,
  onClose,
  cashierName,
  canReprint = false,
  insufficientStock = [],
}: CheckoutDialogProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [hasPrinted, setHasPrinted] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleConfirm = () => {
    if (selectedMethod) {
      onConfirmPayment(selectedMethod);
    }
  };

  const handlePrint = (copyType: "customer" | "office") => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const copyLabel = copyType === "customer" ? "CUSTOMER COPY" : "OFFICE COPY";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${completedOrder?.order_number} (${copyLabel})</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', Courier, monospace;
              padding: 10px;
              max-width: 80mm;
              margin: 0 auto;
            }
            .receipt { font-size: 12px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 18px; }
            .text-base { font-size: 14px; }
            .text-xs { font-size: 11px; }
            .text-10 { font-size: 10px; }
            .my-3 { margin: 10px 0; }
            .mt-2 { margin-top: 8px; }
            .mt-4 { margin-top: 16px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .flex { display: flex; justify-content: space-between; }
            .border-dashed { border-top: 1px dashed #999; }
            .border-solid { border-top: 1px solid #333; }
            .gray { color: #666; }
            .pl-4 { padding-left: 16px; }
            .copy-label { 
              text-align: center; 
              font-weight: bold; 
              border: 1px dashed #333;
              padding: 4px;
              margin-bottom: 10px;
            }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="copy-label">${copyLabel}</div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handlePrintBoth = () => {
    handlePrint("customer");
    setTimeout(() => handlePrint("office"), 500);
    setHasPrinted(true);
  };

  const handleClose = () => {
    setSelectedMethod(null);
    setHasPrinted(false);
    onClose();
  };

  // Show receipt after successful payment
  if (completedOrder) {
    return (
      <Dialog open={open} onOpenChange={() => handleClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
              <Check className="h-6 w-6 text-emerald-500" />
              Payment Successful
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Receipt Preview */}
            <div className="flex justify-center bg-muted/50 rounded-lg p-4 overflow-auto max-h-[400px]">
              <Receipt
                ref={receiptRef}
                orderNumber={completedOrder.order_number}
                orderType={orderType}
                tableNumber={tableNumber || undefined}
                items={cart}
                subtotal={subtotal}
                total={total}
                paymentMethod={selectedMethod || "cash"}
                cashierName={cashierName}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {!hasPrinted ? (
                <Button
                  className="w-full"
                  onClick={handlePrintBoth}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt (Customer + Office Copy)
                </Button>
              ) : (
                <div className="flex gap-3">
                  {canReprint && (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={handlePrintBoth}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Reprint
                    </Button>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
