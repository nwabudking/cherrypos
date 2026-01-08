import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, XCircle } from "lucide-react";

interface StockWarningAlertProps {
  insufficientItems: Array<{ name: string; available: number; requested: number }>;
}

export const StockWarningAlert = ({ insufficientItems }: StockWarningAlertProps) => {
  if (insufficientItems.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <XCircle className="h-4 w-4" />
      <AlertTitle>Insufficient Stock</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1">
          {insufficientItems.map((item, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3 w-3" />
              <span>
                <strong>{item.name}</strong>: Need {item.requested}, only {item.available} available
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
