import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCashierAssignment } from "@/hooks/useCashierAssignment";
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
} from "lucide-react";
import { format } from "date-fns";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

const TransfersPage = () => {
  const { role, user } = useAuth();
  const assignmentQuery = useCashierAssignment(user?.id || "");
  const assignment = assignmentQuery.data;
  
  const isAdmin = role === "super_admin" || role === "manager" || role === "store_admin";
  const isCashier = role === "cashier";
  const assignedBarId = assignment?.bar_id;

  const { data: bars = [] } = useBars();
  const { data: allTransfers = [] } = useBarToBarTransfers();
  const { data: pendingTransfers = [] } = usePendingTransfersForBar(assignedBarId || "");
  
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [sourceBarId, setSourceBarId] = useState("");
  const [destinationBarId, setDestinationBarId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  
  const { data: sourceInventory = [] } = useBarInventory(isCashier ? (assignedBarId || "") : sourceBarId);
  const selectedItem = sourceInventory.find(i => i.inventory_item_id === inventoryItemId);
  
  const createTransferMutation = useCreateBarToBarTransfer();
  const respondMutation = useRespondToTransfer();
  
  const activeBars = bars.filter(b => b.is_active);

  const filteredTransfers = isCashier && assignedBarId
    ? allTransfers.filter(t => t.source_bar_id === assignedBarId || t.destination_bar_id === assignedBarId)
    : allTransfers;

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
    
    const effectiveSourceBarId = isCashier ? assignedBarId! : sourceBarId;
    
    createTransferMutation.mutate({
      sourceBarId: effectiveSourceBarId,
      destinationBarId,
      inventoryItemId,
      quantity,
      notes: notes || undefined,
      isAdminTransfer: isAdmin,
    }, {
      onSuccess: () => setTransferDialogOpen(false),
    });
  };

  const handleRespondToTransfer = (transferId: string, response: 'accepted' | 'rejected') => {
    respondMutation.mutate({ transferId, response });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'accepted':
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
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

  if (isCashier && !assignedBarId && !assignmentQuery.isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Bar Assignment</h2>
            <p className="text-muted-foreground">You are not assigned to any bar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            Bar Transfers
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Transfer inventory between bar locations" : "Request and accept bar-to-bar transfers"}
          </p>
        </div>
        <Button onClick={handleOpenTransferDialog}>
          <Send className="h-4 w-4 mr-2" />
          {isAdmin ? "Transfer Items" : "Request Transfer"}
        </Button>
      </div>

      {isCashier && pendingTransfers.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5 text-amber-500" />
              Pending Transfer Requests
              <Badge variant="outline" className="bg-amber-100 text-amber-700">{pendingTransfers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTransfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1">
                    <div className="font-medium">{transfer.inventory_item?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      From: {transfer.source_bar?.name} • Qty: {transfer.quantity} {transfer.inventory_item?.unit}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleRespondToTransfer(transfer.id, 'rejected')} disabled={respondMutation.isPending}>
                      <XCircle className="h-4 w-4 mr-1" />Reject
                    </Button>
                    <Button size="sm" onClick={() => handleRespondToTransfer(transfer.id, 'accepted')} disabled={respondMutation.isPending}>
                      <CheckCircle className="h-4 w-4 mr-1" />Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>All bar-to-bar transfer records</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>Export PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>Export Excel</Button>
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transfer records found</TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{transfer.created_at ? format(new Date(transfer.created_at), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
                      <TableCell>{transfer.source_bar?.name || '-'}</TableCell>
                      <TableCell>{transfer.destination_bar?.name || '-'}</TableCell>
                      <TableCell>{transfer.inventory_item?.name || '-'}</TableCell>
                      <TableCell className="text-right">{transfer.quantity} {transfer.inventory_item?.unit}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {isAdmin ? "Transfer Items" : "Request Transfer"}
            </DialogTitle>
            <DialogDescription>
              {isAdmin ? "Transfer inventory between bars immediately" : "Request a transfer. The receiving cashier must accept."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleCreateTransfer(); }} className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label>From Bar</Label>
                <Select value={sourceBarId} onValueChange={(v) => { setSourceBarId(v); setInventoryItemId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select source bar" /></SelectTrigger>
                  <SelectContent>
                    {activeBars.map((bar) => (
                      <SelectItem key={bar.id} value={bar.id} disabled={bar.id === destinationBarId}>{bar.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isCashier && (
              <div className="p-3 rounded-lg bg-muted/50">
                <Label className="text-sm text-muted-foreground">From Bar</Label>
                <p className="font-medium">{bars.find(b => b.id === assignedBarId)?.name}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>To Bar</Label>
              <Select value={destinationBarId} onValueChange={setDestinationBarId}>
                <SelectTrigger><SelectValue placeholder="Select destination bar" /></SelectTrigger>
                <SelectContent>
                  {activeBars.filter(bar => bar.id !== (isCashier ? assignedBarId : sourceBarId)).map((bar) => (
                    <SelectItem key={bar.id} value={bar.id}>{bar.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(isCashier || sourceBarId) && (
              <div className="space-y-2">
                <Label>Item to Transfer</Label>
                <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {sourceInventory.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">No inventory</div>
                    ) : (
                      sourceInventory.map((item) => (
                        <SelectItem key={item.inventory_item_id} value={item.inventory_item_id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>{item.inventory_item?.name}</span>
                            <span className="text-muted-foreground">({item.current_stock} {item.inventory_item?.unit})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedItem && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between">
                  <span>Available:</span>
                  <span className="font-bold">{selectedItem.current_stock} {selectedItem.inventory_item?.unit}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" min={1} max={selectedItem?.current_stock || 999} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for transfer..." rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createTransferMutation.isPending || !destinationBarId || !inventoryItemId || quantity <= 0}>
                {createTransferMutation.isPending ? "Processing..." : isAdmin ? "Transfer Now" : "Send Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransfersPage;
