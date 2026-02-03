'use client';

import { useState } from 'react';
import { useInventory, useUpdateInventory } from '@/hooks/useInventory';
import { useLogInventoryPrint } from '@/hooks/useInventoryFulfillment';
import { usePrinters } from '@/hooks/usePrinters';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Printer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogPrintDialogProps {
  open: boolean;
  onClose: () => void;
  partId: string;
  partName: string;
  partsPerPrint: number;
}

function LogPrintDialog({
  open,
  onClose,
  partId,
  partName,
  partsPerPrint,
}: LogPrintDialogProps) {
  const [printCount, setPrintCount] = useState('1');
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [printerId, setPrinterId] = useState<string>('');
  const logPrint = useLogInventoryPrint();
  const { data: printers } = usePrinters();

  const handleSubmit = async () => {
    const qty = parseInt(printCount);
    if (isNaN(qty) || qty < 1) {
      toast.error('Please enter a valid number of prints');
      return;
    }

    const partsProduced = status === 'success' ? qty * partsPerPrint : 0;

    try {
      await logPrint.mutateAsync({
        part_id: partId,
        quantity_printed: partsProduced,
        status,
        printer_id: printerId || undefined,
      });
      toast.success(
        status === 'success'
          ? `Added ${partsProduced} ${partName} to inventory`
          : `Logged ${qty} failed print(s)`
      );
      onClose();
      setPrintCount('1');
      setStatus('success');
      setPrinterId('');
    } catch {
      toast.error('Failed to log print');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Print Completion</DialogTitle>
          <DialogDescription>
            Record a completed print for {partName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Print Status</Label>
            <Select
              value={status}
              onValueChange={(value: 'success' | 'failed') => setStatus(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Success
                  </span>
                </SelectItem>
                <SelectItem value="failed">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Failed
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="printCount">Number of Prints</Label>
            <Input
              id="printCount"
              type="number"
              min="1"
              value={printCount}
              onChange={(e) => setPrintCount(e.target.value)}
            />
            {status === 'success' && (
              <p className="text-xs text-gray-500">
                {printCount} print{parseInt(printCount) !== 1 ? 's' : ''} × {partsPerPrint} parts/print ={' '}
                <span className="font-medium">
                  {(parseInt(printCount) || 0) * partsPerPrint} parts
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Printer (optional)</Label>
            <Select value={printerId} onValueChange={setPrinterId}>
              <SelectTrigger>
                <SelectValue placeholder="Select printer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {printers?.map((printer) => (
                  <SelectItem key={printer.id} value={printer.id}>
                    {printer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === 'success' && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
              <p className="font-medium">
                This will add {(parseInt(printCount) || 0) * partsPerPrint} parts to inventory
              </p>
              <p className="text-green-600 text-xs mt-1">
                Inventory will auto-allocate to waiting orders
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={logPrint.isPending}>
            {logPrint.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Log Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  partId: string;
  partName: string;
  currentQuantity: number;
}

function AdjustmentDialog({
  open,
  onClose,
  partId,
  partName,
  currentQuantity,
}: AdjustmentDialogProps) {
  const [quantity, setQuantity] = useState(currentQuantity.toString());
  const [reason, setReason] = useState('');
  const updateInventory = useUpdateInventory();

  const handleSubmit = async () => {
    const newQty = parseInt(quantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      await updateInventory.mutateAsync({
        partId,
        quantity: newQty,
        reason: reason || undefined,
      });
      toast.success('Inventory updated successfully');
      onClose();
    } catch {
      toast.error('Failed to update inventory');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Update the stock level for {partName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">New Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Current: {currentQuantity} units
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g., Physical count adjustment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateInventory.isPending}>
            {updateInventory.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState<{
    partId: string;
    partName: string;
    quantity: number;
  } | null>(null);
  const [loggingPrint, setLoggingPrint] = useState<{
    partId: string;
    partName: string;
    partsPerPrint: number;
  } | null>(null);
  const { canEdit } = useAuth();
  const { data: inventory, isLoading } = useInventory();

  const filteredInventory = inventory?.filter((item) =>
    item.part.name.toLowerCase().includes(search.toLowerCase()) ||
    item.part.products?.some(p => p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const getStockLevel = (onHand: number, reserved: number, threshold: number) => {
    const available = onHand - reserved;
    const percentage = threshold > 0 ? Math.min((available / threshold) * 100, 100) : 100;

    if (available <= 0) {
      return { status: 'critical', percentage: 0, color: 'bg-orange-500' };
    }
    if (available < threshold) {
      return { status: 'low', percentage, color: 'bg-yellow-500' };
    }
    return { status: 'healthy', percentage: 100, color: 'bg-green-500' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">Track and manage part stock levels</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate summary stats
  const totalParts = filteredInventory?.reduce((sum, i) => sum + i.quantity_on_hand, 0) || 0;
  const lowStockCount = filteredInventory?.filter((i) => {
    const available = i.quantity_on_hand - i.quantity_reserved;
    return available < i.part.low_stock_threshold;
  }).length || 0;
  const outOfStockCount = filteredInventory?.filter((i) => {
    const available = i.quantity_on_hand - i.quantity_reserved;
    return available <= 0;
  }).length || 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500">Track and manage part stock levels</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <Package className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Parts</p>
              <p className="text-2xl font-bold">{totalParts.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? 'border-yellow-200' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              lowStockCount > 0 ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                lowStockCount > 0 ? 'text-yellow-600' : 'text-green-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={outOfStockCount > 0 ? 'border-orange-200' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              outOfStockCount > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              {outOfStockCount > 0 ? (
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search inventory..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>On Hand</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory?.map((item) => {
                const available = item.quantity_on_hand - item.quantity_reserved;
                const stockLevel = getStockLevel(
                  item.quantity_on_hand,
                  item.quantity_reserved,
                  item.part.low_stock_threshold
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">
                        {item.part.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.part.products?.map((prod) => (
                          <Badge
                            key={prod.id}
                            variant="secondary"
                            className="bg-gray-100 text-gray-700"
                          >
                            {prod.name}
                          </Badge>
                        ))}
                        {(!item.part.products || item.part.products.length === 0) && (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {item.quantity_on_hand}
                    </TableCell>
                    <TableCell className="font-mono text-gray-500">
                      {item.quantity_reserved}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {available}
                    </TableCell>
                    <TableCell className="w-[150px]">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={stockLevel.percentage}
                          className={`h-2 ${stockLevel.color}`}
                        />
                        <span className="text-xs text-gray-500 w-8">
                          {item.part.low_stock_threshold}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          stockLevel.status === 'critical'
                            ? 'bg-orange-100 text-orange-700'
                            : stockLevel.status === 'low'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }
                      >
                        {stockLevel.status === 'critical'
                          ? 'Out of Stock'
                          : stockLevel.status === 'low'
                          ? 'Low Stock'
                          : 'In Stock'}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLoggingPrint({
                                partId: item.part_id,
                                partName: item.part.name,
                                partsPerPrint: item.part.parts_per_print || 1,
                              })
                            }
                            title="Log print"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setAdjusting({
                                partId: item.part_id,
                                partName: item.part.name,
                                quantity: item.quantity_on_hand,
                              })
                            }
                            title="Adjust quantity"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjustment dialog */}
      {adjusting && (
        <AdjustmentDialog
          key={adjusting.partId}
          open={!!adjusting}
          onClose={() => setAdjusting(null)}
          partId={adjusting.partId}
          partName={adjusting.partName}
          currentQuantity={adjusting.quantity}
        />
      )}

      {/* Log print dialog */}
      {loggingPrint && (
        <LogPrintDialog
          key={loggingPrint.partId}
          open={!!loggingPrint}
          onClose={() => setLoggingPrint(null)}
          partId={loggingPrint.partId}
          partName={loggingPrint.partName}
          partsPerPrint={loggingPrint.partsPerPrint}
        />
      )}
    </div>
  );
}
