'use client';

import { useState } from 'react';
import { useInventory, useUpdateInventory } from '@/hooks/useInventory';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

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
      return { status: 'critical', percentage: 0, color: 'bg-red-500' };
    }
    if (available < threshold) {
      return { status: 'low', percentage, color: 'bg-orange-500' };
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
        <Card className={lowStockCount > 0 ? 'border-orange-200' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              lowStockCount > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={outOfStockCount > 0 ? 'border-red-200' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              outOfStockCount > 0 ? 'bg-red-100' : 'bg-green-100'
            }`}>
              {outOfStockCount > 0 ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
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
                            ? 'bg-red-100 text-red-700'
                            : stockLevel.status === 'low'
                            ? 'bg-orange-100 text-orange-700'
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}
