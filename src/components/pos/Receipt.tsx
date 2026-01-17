import { forwardRef } from "react";
import { format } from "date-fns";
import type { CartItem } from "@/pages/POS";
import cherryLogo from "@/assets/cherry-logo.png";

interface ReceiptProps {
  orderNumber: string;
  orderType: string;
  tableNumber?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  paymentMethod: string;
  cashierName?: string;
  barName?: string;
  copyType?: "customer" | "office";
}

const orderTypeLabels: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  bar_only: "Bar Only",
};

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  (
    {
      orderNumber,
      orderType,
      tableNumber,
      items,
      subtotal,
      total,
      paymentMethod,
      cashierName,
      barName,
      copyType = "customer",
    },
    ref
  ) => {
    const now = new Date();

    return (
      <div
        ref={ref}
        className="bg-white text-black p-6 w-[300px] font-mono text-sm print:w-full print:max-w-[80mm]"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Copy Type Banner */}
        <div className="text-center mb-2 py-1 bg-gray-100 font-bold text-xs uppercase border border-gray-300">
          {copyType === "customer" ? "CUSTOMER COPY" : "OFFICE COPY"}
        </div>

        {/* Header with Logo */}
        <div className="text-center mb-4">
          <img 
            src={cherryLogo} 
            alt="Cherry Dining & Lounge" 
            className="mx-auto mb-2 w-[60px] h-auto"
          />
          <p className="text-xs mt-2">Nicton Road</p>
          <p className="text-xs">Bayelsa, Nigeria</p>
          <p className="text-xs">Tel: +234 800 000 0000</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Order Info */}
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>Order #:</span>
            <span className="font-bold">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(now, "dd/MM/yyyy")}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{format(now, "HH:mm:ss")}</span>
          </div>
          <div className="flex justify-between">
            <span>Type:</span>
            <span>{orderTypeLabels[orderType] || orderType}</span>
          </div>
          {tableNumber && (
            <div className="flex justify-between">
              <span>Table:</span>
              <span>{tableNumber}</span>
            </div>
          )}
          {barName && (
            <div className="flex justify-between">
              <span>Bar:</span>
              <span className="font-bold">{barName}</span>
            </div>
          )}
          {cashierName && (
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{cashierName}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Items */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span>ITEM</span>
            <span>AMOUNT</span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="text-xs">
              <div className="flex justify-between">
                <span className="flex-1 truncate pr-2">
                  {item.quantity}x {item.name}
                </span>
                <span>₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
              {item.notes && (
                <p className="text-[10px] text-gray-600 pl-4">Note: {item.notes}</p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Totals */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-400 my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL:</span>
            <span>₦{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Payment */}
        <div className="text-xs">
          <div className="flex justify-between">
            <span>Payment Method:</span>
            <span className="font-bold">{paymentLabels[paymentMethod] || paymentMethod}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Status:</span>
            <span className="font-bold">PAID</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-3" />

        {/* Footer */}
        <div className="text-center text-xs space-y-2">
          <p className="font-bold">Thank you for dining with us!</p>
          <p>We hope to see you again soon.</p>
          <p className="text-[10px] text-gray-500 mt-4">
            This receipt serves as proof of payment
          </p>
        </div>
      </div>
    );
  }
);

Receipt.displayName = "Receipt";