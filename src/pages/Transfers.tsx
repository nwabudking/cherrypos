import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCashierAssignment } from "@/hooks/useCashierAssignment";
import { useTransferNotifications } from "@/hooks/useTransferNotifications";
import {
  useBars,
  useBarInventory,
  useBarToBarTransfers,
  usePendingTransfersForBar,
  useCreateBarToBarTransfer,
  useRespondToTransfer,
} from "@/hooks/useBars";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRightLeft,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  AlertCircle,
  Inbox,
  Layers,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { BatchTransferDialog } from "@/components/store/BatchTransferDialog";

const TransfersPage = () => {
  const { role, user } = useAuth();
  const assignmentQuery = useCashierAssignment(user?.id || "");
  const assignment = assignmentQuery.data;
  
  const isAdmin = role === "super_admin" || role === "manager" || role === "store_admin";
  const isCashier = role === "cashier";
  const assignedBarId = assignment?.bar_id;

  // Enable transfer notifications for cashiers
  useTransferNotifications({
    enabled: isCashier && !!assignedBarId,
    soundEnabled: true,
    userId: user?.id,
  });

  const { data: bars = [] } = useBars();
  const { data: allTransfers = [], refetch: refetchTransfers } = useBarToBarTransfers();
  const { data: pendingTransfers = [], refetch: refetchPending } = usePendingTransfersForBar(assignedBarId || "");
  
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [batchTransferDialogOpen, setBatchTransferDialogOpen] = useState(false);
  const [sourceBarId, setSourceBarId] = useState("");
  const [destinationBarId, setDestinationBarId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  
  // For cashiers: show inventory from their assigned bar (sender)
  // For admins: show inventory from selected source bar
  const effectiveSourceBarId = isCashier ? (assignedBarId || "") : sourceBarId;
  const { data: sourceInventory = [] } = useBarInventory(effectiveSourceBarId);
  const selectedItem = sourceInventory.find(i => i.inventory_item_id === inventoryItemId);
  
  const createTransferMutation = useCreateBarToBarTransfer();
  const respondMutation = useRespondToTransfer();
  
  const activeBars = bars.filter(b => b.is_active);

  // Filter transfers based on user role
  const filteredTransfers = isCashier && assignedBarId
    ? allTransfers.filter(t => t.source_bar_id === assignedBarId || t.destination_bar_id === assignedBarId)
    : allTransfers;

  // Get incoming transfer requests for cashiers (where they are destination)
  const incomingRequests = isCashier && assignedBarId
    ? pendingTransfers.filter(t => t.destination_bar_id === assignedBarId)
    : [];

  const handleOpenTransferDialog = () => {
    if (isCashier && assignedBarId) {
      setSourceBarId(assignedBarId);
    } else {
      setSourceBarId("");
    }
    setDestinationBarId("");
    setInventoryItemId("");
    setQuantity(1);
    setNotes("");
    setTransferDialogOpen(true);
  };

  const handleCreateTransfer = () => {
    if (!inventoryItemId || !destinationBarId || quantity <= 0) return;
    
    const effectiveSrcBarId = isCashier ? assignedBarId! : sourceBarId;
    
    // Validate quantity against available stock
    if (selectedItem && quantity > selectedItem.current_stock) {
      return;
    }
    
    createTransferMutation.mutate({
      sourceBarId: effectiveSrcBarId,
      destinationBarId,
      inventoryItemId,
      quantity,
      notes: notes || undefined,
      isAdminTransfer: isAdmin,
    }, {
      onSuccess: () => {
        setTransferDialogOpen(false);
        setInventoryItemId("");
        setQuantity(1);
        setNotes("");
        refetchTransfers();
      },
    });
  };

  const handleRespondToTransfer = (transferId: string, response: 'accepted' | 'rejected') => {
    respondMutation.mutate({ transferId, response }, {
      onSuccess: () => {
        refetchPending();
        refetchTransfers();
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />Pending
          </Badge>
        );
      case 'accepted':
      case 'completed':
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
            <CheckCircle className="h-3 w-3 mr-1" />Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportPDF = () => {
    const data = filteredTransfers.map(t => ({
      Date: t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy HH:mm') : '-',
      From: t.source_bar?.name || '-',
      To: t.destination_bar?.name || '-',
      Item: t.inventory_item?.name || '-',
      Quantity: `${t.quantity} ${t.inventory_item?.unit || ''}`,
      Status: t.status,
    }));
    exportToPDF(data, 'Bar-to-Bar Transfers', 'bar-transfers');
  };

  const handleExportExcel = () => {
    exportToExcel('bar-transfers', filteredTransfers.map(t => ({
      date: t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy HH:mm') : '-',
      from: t.source_bar?.name || '-',
      to: t.destination_bar?.name || '-',
      item: t.inventory_item?.name || '-',
      quantity: t.quantity,
      status: t.status,
      notes: t.notes || '-',
    })), [
      { key: 'date', header: 'Date' },
      { key: 'from', header: 'From' },
      { key: 'to', header: 'To' },
      { key: 'item', header: 'Item' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'status', header: 'Status' },
      { key: 'notes', header: 'Notes' },
    ]);
  };

  // Show no bar assignment message for cashiers without a bar
  if (isCashier && !assignedBarId && !assignmentQuery.isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Bar Assignment</h2>
            <p className="text-muted-foreground">
              You are not assigned to any bar. Contact your manager to get assigned.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignedBarName = bars.find(b => b.id === assignedBarId)?.name;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Bar Transfers
          </h1>
          <p className="text-muted-foreground">
            {isAdmin 
              ? "Transfer inventory between bar locations" 
              : `Request transfers from ${assignedBarName || 'your bar'} to other bars`}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setBatchTransferDialogOpen(true)}>
              <Layers className="h-4 w-4 mr-2" />
              Batch Transfer
            </Button>
          )}
          <Button onClick={handleOpenTransferDialog}>
            <Send className="h-4 w-4 mr-2" />
            {isAdmin ? "Transfer Items" : "Send Transfer"}
          </Button>
        </div>
      </div>

      {/* Cashier Info Banner */}
      {isCashier && assignedBarId && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">You are assigned to: {assignedBarName}</p>
                <p className="text-sm text-muted-foreground">
                  Transfers you send will immediately deduct from your bar's inventory. 
                  Receiving bar's cashier must accept for items to be added to their stock.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incoming Transfer Requests (for cashiers to accept/reject) */}
      {isCashier && incomingRequests.length > 0 && (
        <Card className="border-amber-500 border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5 text-amber-500" />
              Incoming Transfer Requests
              <Badge variant="outline" className="bg-amber-100 text-amber-700">
                {incomingRequests.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Accept to add items to your bar's inventory, or reject to decline the transfer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incomingRequests.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-amber-100">
                      <Package className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">
                        {transfer.inventory_item?.name}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{transfer.source_bar?.name}</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="font-medium text-foreground">{transfer.destination_bar?.name}</span>
                      </div>
                      <div className="text-sm font-medium text-primary mt-1">
                        Quantity: {transfer.quantity} {transfer.inventory_item?.unit}
                      </div>
                      {transfer.notes && (
                        <p className="text-xs text-muted-foreground mt-1">Note: {transfer.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleRespondToTransfer(transfer.id, 'rejected')} 
                      disabled={respondMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleRespondToTransfer(transfer.id, 'accepted')} 
                      disabled={respondMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>
              {isCashier 
                ? `Transfers involving ${assignedBarName}` 
                : "All bar-to-bar transfer records"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Transferred By</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No transfer records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        {transfer.created_at 
                          ? format(new Date(transfer.created_at), 'MMM d, yyyy HH:mm') 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={transfer.source_bar_id === assignedBarId ? 'font-semibold text-primary' : ''}>
                          {transfer.source_bar?.name || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={transfer.destination_bar_id === assignedBarId ? 'font-semibold text-primary' : ''}>
                          {transfer.destination_bar?.name || '-'}
                        </span>
                      </TableCell>
                      <TableCell>{transfer.inventory_item?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {transfer.quantity} {transfer.inventory_item?.unit}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {transfer.requester?.full_name || transfer.requester?.email || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {transfer.status === 'completed' || transfer.status === 'accepted'
                            ? (transfer.approver?.full_name || transfer.approver?.email || 
                               (transfer.requester?.full_name ? `${transfer.requester.full_name} (Auto)` : '-'))
                            : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-5 w-5" />
              {isAdmin ? "Transfer Items" : "Send Transfer"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {isAdmin 
                ? "Transfer inventory between bars immediately" 
                : "Items are deducted from your bar immediately. Receiver must accept."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateTransfer(); }} className="space-y-3">
            {/* Source Bar Selection (Admin only) */}
            {isAdmin && (
              <div className="space-y-2">
                <Label>From Bar</Label>
                <Select 
                  value={sourceBarId} 
                  onValueChange={(v) => { 
                    setSourceBarId(v); 
                    setInventoryItemId(""); 
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source bar" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBars.map((bar) => (
                      <SelectItem 
                        key={bar.id} 
                        value={bar.id} 
                        disabled={bar.id === destinationBarId}
                      >
                        {bar.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cashier: Show assigned bar info */}
            {isCashier && (
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">From:</span>
                <span className="font-semibold text-primary">{assignedBarName}</span>
              </div>
            )}

            {/* Destination Bar Selection */}
            <div className="space-y-2">
              <Label>To Bar</Label>
              <Select value={destinationBarId} onValueChange={setDestinationBarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination bar" />
                </SelectTrigger>
                <SelectContent>
                  {activeBars
                    .filter(bar => bar.id !== effectiveSourceBarId)
                    .map((bar) => (
                      <SelectItem key={bar.id} value={bar.id}>
                        {bar.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Selection */}
            {effectiveSourceBarId && (
              <div className="space-y-2">
                <Label>Item to Transfer</Label>
                <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceInventory.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No inventory available
                      </div>
                    ) : (
                      sourceInventory
                        .filter(item => item.current_stock > 0)
                        .map((item) => (
                          <SelectItem 
                            key={item.inventory_item_id} 
                            value={item.inventory_item_id}
                          >
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              <span>{item.inventory_item?.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {item.current_stock} {item.inventory_item?.unit}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stock Info */}
            {selectedItem && (
              <div className="p-2 rounded-lg bg-muted/50 text-sm flex items-center justify-between">
                <span>Available:</span>
                <span className="font-bold">
                  {selectedItem.current_stock} {selectedItem.inventory_item?.unit}
                  {quantity > selectedItem.current_stock && (
                    <span className="text-red-500 ml-2">⚠️ Exceeds stock</span>
                  )}
                </span>
              </div>
            )}

            {/* Quantity Input */}
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity</Label>
              <Input 
                id="quantity" 
                type="number" 
                min={1} 
                max={selectedItem?.current_stock || 999} 
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))} 
                required 
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea 
                id="notes" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Reason for transfer..." 
                rows={2} 
                className="resize-none"
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setTransferDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  createTransferMutation.isPending || 
                  !destinationBarId || 
                  !inventoryItemId || 
                  quantity <= 0 ||
                  (selectedItem && quantity > selectedItem.current_stock)
                }
              >
                {createTransferMutation.isPending 
                  ? "Processing..." 
                  : isAdmin 
                    ? "Transfer Now" 
                    : "Send Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Batch Transfer Dialog (Admin only) */}
      <BatchTransferDialog
        open={batchTransferDialogOpen}
        onOpenChange={setBatchTransferDialogOpen}
      />
    </div>
  );
};

export default TransfersPage;
