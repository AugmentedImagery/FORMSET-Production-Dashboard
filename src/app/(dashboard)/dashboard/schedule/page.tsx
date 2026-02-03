'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useDetailedPartDemand, useLogInventoryPrint, useGcodeMappings } from '@/hooks/useInventoryFulfillment';
import { usePrinters } from '@/hooks/usePrinters';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Printer,
  Clock,
  AlertTriangle,
  Package,
  CheckCircle2,
  XCircle,
  Box,
  Layers,
  Target,
  FileCode,
  Plus,
} from 'lucide-react';
import { formatPrintTime } from '@/lib/scheduling';

export default function SchedulePage() {
  const { data: demandData, isLoading, error, refetch } = useDetailedPartDemand();
  const { data: allPrinters } = usePrinters();
  const { data: orders } = useOrders();
  const { data: gcodeMappings } = useGcodeMappings();
  const { canEdit } = useAuth();
  const logPrint = useLogInventoryPrint();

  // Only count printers that are linked (have bambu_device_id)
  const linkedPrinters = allPrinters?.filter(p => p.bambu_device_id) || [];
  const printers = linkedPrinters;

  // Check for pending orders without allocations (need migration)
  const pendingOrders = orders?.filter(o =>
    o.status === 'pending' || o.status === 'in_production'
  ) || [];
  const ordersWithoutAllocations = pendingOrders.filter(o =>
    !o.allocations || o.allocations.length === 0
  );
  const hasOrdersNeedingMigration = ordersWithoutAllocations.length > 0;

  // Log print dialog state
  const [logPrintDialog, setLogPrintDialog] = useState<{
    open: boolean;
    partId: string;
    partName: string;
    partsPerPrint: number;
    printTimeMinutes: number;
    gcodeMappingFilename?: string;
  } | null>(null);
  const [logPrintQty, setLogPrintQty] = useState(1);
  const [logPrintPrinterId, setLogPrintPrinterId] = useState<string>('');
  const [logPrintStatus, setLogPrintStatus] = useState<'success' | 'failed'>('success');
  const [isLogging, setIsLogging] = useState(false);

  // Calculate summary stats
  const stats = demandData?.reduce(
    (acc, item) => {
      acc.totalPrintsNeeded += item.printsRequired;
      acc.totalPartsNeeded += item.deficit;
      acc.totalTimeMinutes += item.printsRequired * (item.part.print_time_minutes || 60);

      const highestPriority = Math.min(
        ...item.orders.map(o =>
          o.priority === 'critical' ? 0 : o.priority === 'rush' ? 1 : 2
        )
      );
      if (highestPriority === 0) acc.criticalItems++;
      else if (highestPriority === 1) acc.rushItems++;

      return acc;
    },
    { totalPrintsNeeded: 0, totalPartsNeeded: 0, totalTimeMinutes: 0, criticalItems: 0, rushItems: 0 }
  ) || { totalPrintsNeeded: 0, totalPartsNeeded: 0, totalTimeMinutes: 0, criticalItems: 0, rushItems: 0 };

  // Group demand by priority
  const priorityGroups = {
    critical: demandData?.filter(d =>
      d.orders.some(o => o.priority === 'critical')
    ) || [],
    rush: demandData?.filter(d =>
      !d.orders.some(o => o.priority === 'critical') &&
      d.orders.some(o => o.priority === 'rush')
    ) || [],
    normal: demandData?.filter(d =>
      !d.orders.some(o => o.priority === 'critical') &&
      !d.orders.some(o => o.priority === 'rush')
    ) || [],
  };

  const handleLogPrint = async () => {
    if (!logPrintDialog) return;

    setIsLogging(true);
    try {
      const partsProduced = logPrintStatus === 'success'
        ? logPrintQty * logPrintDialog.partsPerPrint
        : 0;

      await logPrint.mutateAsync({
        part_id: logPrintDialog.partId,
        quantity_printed: partsProduced,
        status: logPrintStatus,
        printer_id: logPrintPrinterId || undefined,
        gcode_filename: logPrintDialog.gcodeMappingFilename,
      });

      setLogPrintDialog(null);
      setLogPrintQty(1);
      setLogPrintPrinterId('');
      setLogPrintStatus('success');
      refetch();
    } catch (err) {
      console.error('Failed to log print:', err);
    } finally {
      setIsLogging(false);
    }
  };

  const openLogPrintDialog = (item: typeof demandData extends (infer T)[] | undefined ? T : never) => {
    // Find gcode mapping for this part
    const mapping = gcodeMappings?.find(m => m.part_id === item.part.id && m.is_active);

    setLogPrintDialog({
      open: true,
      partId: item.part.id,
      partName: item.part.name,
      partsPerPrint: item.part.parts_per_print || 1,
      printTimeMinutes: item.part.print_time_minutes || 60,
      gcodeMappingFilename: mapping?.gcode_filename,
    });
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'critical') {
      return <Badge className="bg-orange-500 text-white">Critical</Badge>;
    }
    if (priority === 'rush') {
      return <Badge className="bg-yellow-500 text-white">Rush</Badge>;
    }
    return <Badge variant="outline">Normal</Badge>;
  };

  const getPriorityIndicator = (priority: string) => {
    if (priority === 'critical') {
      return <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />;
    }
    if (priority === 'rush') {
      return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
    }
    return null;
  };

  const renderDemandCard = (item: NonNullable<typeof demandData>[number], showPriority = false) => {
    const highestPriority = item.orders.reduce((best, o) => {
      if (o.priority === 'critical') return 'critical';
      if (o.priority === 'rush' && best !== 'critical') return 'rush';
      return best;
    }, 'normal' as string);

    const earliestDue = item.orders
      .filter(o => o.dueDate)
      .map(o => new Date(o.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const hasGcodeMapping = gcodeMappings?.some(m => m.part_id === item.part.id && m.is_active);

    return (
      <Card
        key={item.part.id}
        className={`overflow-hidden border-l-4 ${
          highestPriority === 'critical'
            ? 'border-l-orange-500 bg-orange-50/30'
            : highestPriority === 'rush'
            ? 'border-l-yellow-500 bg-yellow-50/30'
            : 'border-l-gray-300'
        }`}
      >
        <CardContent className="p-4">
          {/* Part header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {getPriorityIndicator(highestPriority)}
              <div>
                <h3 className="font-semibold text-gray-900">{item.part.name}</h3>
                <p className="text-xs text-gray-500">
                  {item.part.material_type} • {item.part.color || 'No color'}
                </p>
              </div>
            </div>
            {showPriority && getPriorityBadge(highestPriority)}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-lg p-2 border">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <Target className="h-3 w-3" />
                Deficit
              </div>
              <p className="text-lg font-bold text-gray-900">{item.deficit} parts</p>
            </div>
            <div className="bg-white rounded-lg p-2 border">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <Printer className="h-3 w-3" />
                Prints Needed
              </div>
              <p className="text-lg font-bold text-[#7a756a]">{item.printsRequired}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Parts per print
              </span>
              <span className="font-medium">{item.part.parts_per_print || 1}</span>
            </div>

            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Print time
              </span>
              <span className="font-medium">
                {formatPrintTime(item.part.print_time_minutes || 60)} / print
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Total time
              </span>
              <span className="font-medium">
                {formatPrintTime(item.printsRequired * (item.part.print_time_minutes || 60))}
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Box className="h-3.5 w-3.5" />
                Available
              </span>
              <span className="font-medium">{item.availableInventory} parts</span>
            </div>

            {earliestDue && (
              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Earliest due
                </span>
                <span className={`font-medium ${
                  earliestDue < new Date() ? 'text-orange-600' : ''
                }`}>
                  {format(earliestDue, 'MMM d')}
                </span>
              </div>
            )}

            {/* Gcode mapping status */}
            <div className="flex items-center justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <FileCode className="h-3.5 w-3.5" />
                Gcode mapping
              </span>
              {hasGcodeMapping ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Configured
                </span>
              ) : (
                <Link
                  href={`/dashboard/parts/${item.part.id}`}
                  className="flex items-center gap-1 text-orange-600 font-medium hover:underline"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Not set
                </Link>
              )}
            </div>
          </div>

          {/* Orders waiting */}
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-2">
              {item.orders.length} order{item.orders.length !== 1 ? 's' : ''} waiting:
            </p>
            <div className="flex flex-wrap gap-1">
              {item.orders.slice(0, 5).map((order) => (
                <Link
                  key={order.orderId}
                  href={`/dashboard/orders/${order.orderId}`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 ${
                    order.priority === 'critical'
                      ? 'bg-orange-100 text-orange-700'
                      : order.priority === 'rush'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {getPriorityIndicator(order.priority)}
                  <span>{order.quantityNeeded} parts</span>
                </Link>
              ))}
              {item.orders.length > 5 && (
                <span className="text-xs text-gray-400 px-2 py-1">
                  +{item.orders.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* Log print button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => openLogPrintDialog(item)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Log Print
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
            <p className="text-gray-500">What needs to be printed based on order demand</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
            <p className="text-gray-500">What needs to be printed based on order demand</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-orange-600 font-medium">Error loading schedule</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availablePrinters = printers?.filter(p => p.status === 'idle' || p.status === 'printing') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
          <p className="text-gray-500">What needs to be printed based on order demand</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-[#999184]/20 flex items-center justify-center">
              <Printer className="h-5 w-5 text-[#7a756a]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Prints Needed</p>
              <p className="text-xl font-bold">{stats.totalPrintsNeeded}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Parts Needed</p>
              <p className="text-xl font-bold">{stats.totalPartsNeeded}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Est. Print Time</p>
              <p className="text-xl font-bold">{formatPrintTime(stats.totalTimeMinutes)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              stats.criticalItems > 0 ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                stats.criticalItems > 0 ? 'text-orange-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Critical Items</p>
              <p className={`text-xl font-bold ${stats.criticalItems > 0 ? 'text-orange-600' : ''}`}>
                {stats.criticalItems}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Printer className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Linked Printers</p>
              <p className="text-xl font-bold">{availablePrinters.length} active / {printers?.length || 0} linked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state - check if orders need allocation migration */}
      {demandData?.length === 0 && hasOrdersNeedingMigration && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-lg font-medium text-gray-900">Orders Need Setup</p>
            <p className="text-gray-600 mt-1">
              {ordersWithoutAllocations.length} existing order{ordersWithoutAllocations.length !== 1 ? 's' : ''} need part allocations to show demand.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              New orders will automatically track demand. For existing orders,
              you can re-save them or wait for the next database sync.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state - truly all caught up */}
      {demandData?.length === 0 && !hasOrdersNeedingMigration && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium text-gray-900">All caught up!</p>
            <p className="text-gray-500 mt-1">
              All orders have sufficient inventory. No printing needed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Critical priority items */}
      {priorityGroups.critical.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-lg font-semibold text-gray-900">
              Critical Priority ({priorityGroups.critical.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityGroups.critical.map(item => renderDemandCard(item))}
          </div>
        </div>
      )}

      {/* Rush priority items */}
      {priorityGroups.rush.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Rush Priority ({priorityGroups.rush.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityGroups.rush.map(item => renderDemandCard(item))}
          </div>
        </div>
      )}

      {/* Normal priority items */}
      {priorityGroups.normal.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Normal Priority ({priorityGroups.normal.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priorityGroups.normal.map(item => renderDemandCard(item))}
          </div>
        </div>
      )}

      {/* Legend */}
      {demandData && demandData.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
            <span>Critical Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Rush Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Gcode mapping configured</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span>Gcode mapping missing (won&apos;t auto-track)</span>
          </div>
        </div>
      )}

      {/* Log Print Dialog */}
      <Dialog
        open={logPrintDialog?.open || false}
        onOpenChange={(open) => !open && setLogPrintDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Print Completion</DialogTitle>
            <DialogDescription>
              Record a print for {logPrintDialog?.partName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Print Status</Label>
              <Select
                value={logPrintStatus}
                onValueChange={(value: 'success' | 'failed') => setLogPrintStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
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
              <Label>Number of Prints</Label>
              <Input
                type="number"
                min={1}
                value={logPrintQty}
                onChange={(e) => setLogPrintQty(parseInt(e.target.value) || 1)}
              />
              {logPrintStatus === 'success' && (
                <p className="text-xs text-gray-500">
                  {logPrintQty} print{logPrintQty !== 1 ? 's' : ''} × {logPrintDialog?.partsPerPrint || 1} parts/print = {' '}
                  <span className="font-medium">{logPrintQty * (logPrintDialog?.partsPerPrint || 1)} parts</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Printer (optional)</Label>
              <Select
                value={logPrintPrinterId}
                onValueChange={setLogPrintPrinterId}
              >
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

            {logPrintDialog?.gcodeMappingFilename && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="text-gray-500">Gcode file:</p>
                <p className="font-mono text-gray-700">{logPrintDialog.gcodeMappingFilename}</p>
              </div>
            )}

            {logPrintStatus === 'success' && (
              <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
                <p className="font-medium">
                  This will add {logPrintQty * (logPrintDialog?.partsPerPrint || 1)} parts to inventory
                </p>
                <p className="text-green-600 text-xs mt-1">
                  Inventory will auto-allocate to waiting orders
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogPrintDialog(null)}
              disabled={isLogging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogPrint}
              disabled={isLogging}
            >
              {isLogging ? 'Logging...' : 'Log Print'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
