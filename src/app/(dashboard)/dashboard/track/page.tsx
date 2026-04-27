'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  useInventoryPrintLog,
  useReviewPrintLog,
  useLogInventoryPrint,
} from '@/hooks/useInventoryFulfillment';
import { usePrinters } from '@/hooks/usePrinters';
import { useParts, type PartWithProduct } from '@/hooks/useParts';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  X,
  Loader2,
  Plus,
  Minus,
  Printer as PrinterIcon,
  Sparkles,
  RefreshCw,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryPrintLog } from '@/types/database';

type Tab = 'review' | 'all';

interface PendingAction {
  entries: InventoryPrintLog[];
  newStatus: 'success' | 'failed';
}

export default function TrackPage() {
  const { canEdit } = useAuth();
  const { data: printLog, isLoading, refetch, isFetching } = useInventoryPrintLog(100);
  const { data: parts, isLoading: partsLoading } = useParts();
  const review = useReviewPrintLog();
  const [tab, setTab] = useState<Tab>('review');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [loggingPart, setLoggingPart] = useState<PartWithProduct | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const filtered = useMemo(() => {
    if (!printLog) return [];
    if (tab === 'review') {
      return printLog.filter((p) => p.source === 'bambu_auto');
    }
    return printLog.slice(0, 30);
  }, [printLog, tab]);

  const reviewCount = useMemo(
    () => printLog?.filter((p) => p.source === 'bambu_auto').length || 0,
    [printLog]
  );

  const visibleIds = useMemo(() => filtered.map((e) => e.id), [filtered]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedEntries = useMemo(
    () => filtered.filter((e) => selected.has(e.id)),
    [filtered, selected]
  );

  const sortedParts = useMemo(() => {
    if (!parts) return [];
    return [...parts].sort((a, b) => a.name.localeCompare(b.name));
  }, [parts]);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const switchTab = (next: Tab) => {
    setTab(next);
    clearSelection();
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBulkRunning(true);
    let successCount = 0;
    let failureCount = 0;

    let lastError: unknown = null;
    for (const entry of pending.entries) {
      try {
        await review.mutateAsync({
          entry: {
            id: entry.id,
            status: entry.status,
            quantity_printed: entry.quantity_printed,
            part_id: entry.part_id,
            part: entry.part ? { parts_per_print: entry.part.parts_per_print } : null,
          },
          newStatus: pending.newStatus,
        });
        successCount++;
      } catch (err) {
        failureCount++;
        lastError = err;
        console.error('Review print failed', err);
      }
    }
    setBulkRunning(false);

    const errMsg =
      lastError instanceof Error ? lastError.message : 'Unknown error';

    if (failureCount === 0) {
      toast.success(
        pending.entries.length === 1
          ? pending.newStatus === 'success'
            ? `Confirmed success — ${pending.entries[0].part?.name || 'part'}`
            : `Marked failed — ${pending.entries[0].part?.name || 'part'}`
          : `Updated ${successCount} prints as ${pending.newStatus}`
      );
    } else if (successCount > 0) {
      toast.error(`Updated ${successCount}, ${failureCount} failed: ${errMsg}`);
    } else {
      toast.error(`Failed to update prints: ${errMsg}`);
    }

    setPending(null);
    setSelected((prev) => {
      const next = new Set(prev);
      pending.entries.forEach((e) => next.delete(e.id));
      return next;
    });
  };

  const requestBulk = (newStatus: 'success' | 'failed') => {
    if (selectedEntries.length === 0) return;
    setPending({ entries: selectedEntries, newStatus });
  };

  const requestSingle = (entry: InventoryPrintLog, newStatus: 'success' | 'failed') => {
    setPending({ entries: [entry], newStatus });
  };

  const hasSelection = selected.size > 0;

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-[#fafafa]">
      <div className="mx-auto max-w-2xl p-4 pb-32 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Print Tracker</h1>
            <p className="text-sm text-gray-500">
              Tap each cleared print to confirm or mark failed
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-11 w-11"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tab pills */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => switchTab('review')}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
              tab === 'review'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            Needs Review
            {reviewCount > 0 && (
              <span
                className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  tab === 'review' ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                }`}
              >
                {reviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => switchTab('all')}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
              tab === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200'
            }`}
          >
            Recent
          </button>
        </div>

        {/* Select all bar */}
        {!isLoading && filtered.length > 0 && canEdit && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-gray-200">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <Checkbox checked={allSelected} />
              {allSelected ? 'Deselect all' : 'Select all'}
              <span className="text-gray-400">({filtered.length})</span>
            </button>
            {hasSelection && (
              <button
                onClick={clearSelection}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Clear ({selected.size})
              </button>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <Sparkles className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {tab === 'review' ? 'All caught up!' : 'No prints yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {tab === 'review'
                ? 'Every recent print has been reviewed. New auto-tracked prints will appear here.'
                : 'Print log is empty. Use the section below to log a print manually.'}
            </p>
          </Card>
        )}

        {/* Print cards */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <PrintCard
                key={entry.id}
                entry={entry}
                disabled={!canEdit || review.isPending || bulkRunning}
                selectable={canEdit}
                selected={selected.has(entry.id)}
                onToggleSelect={() => toggleOne(entry.id)}
                onAction={(newStatus) => requestSingle(entry, newStatus)}
              />
            ))}
          </div>
        )}

        {/* Log a Print section */}
        {canEdit && (
          <div className="mt-10">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Log a Print</h2>
              <p className="text-sm text-gray-500">
                Tap a part to add it manually
              </p>
            </div>

            {partsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : sortedParts.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">
                No parts available
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sortedParts.map((part) => (
                  <PartTile
                    key={part.id}
                    part={part}
                    onClick={() => setLoggingPart(part)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {canEdit && hasSelection && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {selected.size} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-500 underline-offset-2 hover:underline"
              >
                clear
              </button>
            </div>
            <Button
              onClick={() => requestBulk('failed')}
              disabled={bulkRunning}
              className="h-12 bg-red-600 px-4 text-white hover:bg-red-700"
            >
              <X className="mr-1 h-4 w-4" />
              Failed
            </Button>
            <Button
              onClick={() => requestBulk('success')}
              disabled={bulkRunning}
              className="h-12 bg-green-600 px-4 text-white hover:bg-green-700"
            >
              <Check className="mr-1 h-4 w-4" />
              Success
            </Button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !bulkRunning && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending && describeTitle(pending)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && describeAction(pending)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={bulkRunning}
              className={
                pending?.newStatus === 'failed'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {bulkRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending?.newStatus === 'success' ? 'Confirm Success' : 'Mark Failed'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Log print dialog (part pre-selected) */}
      <LogPrintForPart
        part={loggingPart}
        onClose={() => setLoggingPart(null)}
      />
    </div>
  );
}

function describeTitle(p: PendingAction): string {
  const verb = p.newStatus === 'success' ? 'Confirm Success' : 'Mark as Failed';
  return p.entries.length === 1 ? `${verb}?` : `${verb} for ${p.entries.length} prints?`;
}

function describeAction(p: PendingAction): string {
  if (p.entries.length === 1) {
    const entry = p.entries[0];
    const partName = entry.part?.name || 'this part';
    const partsPerPrint = entry.part?.parts_per_print || 1;

    if (p.newStatus === 'failed') {
      if (entry.status === 'success') {
        return `This will remove ${entry.quantity_printed} ${partName} from inventory and record the print as failed.`;
      }
      return `Marks ${partName} print as failed.`;
    }
    if (entry.status === 'failed') {
      return `This will add ${partsPerPrint} ${partName} to inventory.`;
    }
    return `Confirms ${partName} as a successful print. Inventory is unchanged.`;
  }

  let partsAdded = 0;
  let partsRemoved = 0;
  for (const entry of p.entries) {
    const partsPerPrint = entry.part?.parts_per_print || 1;
    if (p.newStatus === 'failed' && entry.status === 'success') {
      partsRemoved += entry.quantity_printed;
    } else if (p.newStatus === 'success' && entry.status === 'failed') {
      partsAdded += partsPerPrint;
    }
  }

  if (p.newStatus === 'failed') {
    return partsRemoved > 0
      ? `This will mark ${p.entries.length} prints as failed and remove ${partsRemoved} parts from inventory.`
      : `Marks ${p.entries.length} prints as failed. No inventory change.`;
  }
  return partsAdded > 0
    ? `This will confirm ${p.entries.length} prints and add ${partsAdded} parts to inventory.`
    : `Confirms ${p.entries.length} prints as successful. Inventory is unchanged.`;
}

interface PrintCardProps {
  entry: InventoryPrintLog;
  disabled: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onAction: (newStatus: 'success' | 'failed') => void;
}

function PrintCard({
  entry,
  disabled,
  selectable,
  selected,
  onToggleSelect,
  onAction,
}: PrintCardProps) {
  const isSuccess = entry.status === 'success';
  const isVerified = entry.source === 'manual';
  const partName = entry.part?.name || 'Unknown part';
  const printerName = entry.printer?.name;
  const timeAgo = formatDistanceToNow(new Date(entry.completed_at), { addSuffix: true });

  return (
    <Card
      className={`overflow-hidden p-0 transition ${isVerified ? 'opacity-70' : ''} ${
        selected ? 'ring-2 ring-gray-900' : ''
      }`}
    >
      <button
        type="button"
        onClick={selectable ? onToggleSelect : undefined}
        disabled={!selectable}
        className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-default"
      >
        {selectable && (
          <div className="pt-0.5">
            <Checkbox checked={selected} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-gray-900">
            {partName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            {printerName && (
              <span className="inline-flex items-center gap-1">
                <PrinterIcon className="h-3.5 w-3.5" />
                {printerName}
              </span>
            )}
            {printerName && <span>·</span>}
            <span>{timeAgo}</span>
          </div>
          {entry.gcode_filename && (
            <p className="mt-1 truncate font-mono text-xs text-gray-400">
              {entry.gcode_filename}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {isVerified ? (
            <Badge className="bg-blue-100 text-blue-700" variant="secondary">
              Verified
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800" variant="secondary">
              Auto
            </Badge>
          )}
          <Badge
            className={
              isSuccess
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }
            variant="secondary"
          >
            {isSuccess ? 'Success' : 'Failed'}
          </Badge>
        </div>
      </button>

      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          onClick={() => onAction('success')}
          disabled={disabled}
          className={`flex h-14 items-center justify-center gap-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${
            isSuccess
              ? 'bg-green-50 text-green-700'
              : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-700'
          }`}
        >
          <Check className="h-5 w-5" />
          {isSuccess && !isVerified ? 'Confirm Success' : 'Success'}
        </button>
        <button
          onClick={() => onAction('failed')}
          disabled={disabled}
          className={`flex h-14 items-center justify-center gap-2 border-l border-gray-100 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${
            !isSuccess
              ? 'bg-orange-50 text-orange-700'
              : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-700'
          }`}
        >
          <X className="h-5 w-5" />
          {!isSuccess && !isVerified ? 'Confirm Failed' : 'Failed'}
        </button>
      </div>
    </Card>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
        checked
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-300 bg-white'
      }`}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </div>
  );
}

function PartTile({
  part,
  onClick,
}: {
  part: PartWithProduct;
  onClick: () => void;
}) {
  const onHand = part.inventory?.quantity_on_hand ?? 0;
  const reserved = part.inventory?.quantity_reserved ?? 0;
  const available = onHand - reserved;
  const color = part.color;

  return (
    <button
      onClick={onClick}
      className="flex min-h-[96px] flex-col items-stretch justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-gray-200 transition active:scale-[0.97] hover:ring-gray-400"
    >
      <div className="flex items-start gap-2">
        {color ? (
          <div
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full ring-1 ring-gray-300"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : (
          <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
        <span className="text-sm font-semibold leading-tight text-gray-900 break-words">
          {part.name}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>In stock</span>
        <span className="font-mono font-semibold text-gray-700">{available}</span>
      </div>
    </button>
  );
}

interface LogPrintForPartProps {
  part: PartWithProduct | null;
  onClose: () => void;
}

function LogPrintForPart({ part, onClose }: LogPrintForPartProps) {
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [printCount, setPrintCount] = useState(1);
  const [printerId, setPrinterId] = useState('');
  const { data: printers } = usePrinters();
  const logPrint = useLogInventoryPrint();

  const partsPerPrint = part?.parts_per_print || 1;
  const partsToAdd = status === 'success' ? printCount * partsPerPrint : 0;

  const reset = () => {
    setStatus('success');
    setPrintCount(1);
    setPrinterId('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!part) return;
    if (printCount < 1) {
      toast.error('Number of prints must be at least 1');
      return;
    }
    try {
      await logPrint.mutateAsync({
        part_id: part.id,
        quantity_printed: partsToAdd,
        status,
        printer_id: printerId || undefined,
      });
      toast.success(
        status === 'success'
          ? `Added ${partsToAdd} ${part.name} to inventory`
          : `Logged failed print for ${part.name}`
      );
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to log print: ${msg}`);
      console.error('Log print failed', err);
    }
  };

  return (
    <Dialog open={!!part} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{part?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status — big visual buttons */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">How did it go?</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStatus('success')}
                className={`flex h-20 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition active:scale-95 ${
                  status === 'success'
                    ? 'bg-green-600 text-white shadow-md ring-2 ring-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Check className="h-7 w-7" strokeWidth={2.5} />
                <span className="text-base">Good</span>
              </button>
              <button
                onClick={() => setStatus('failed')}
                className={`flex h-20 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition active:scale-95 ${
                  status === 'failed'
                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <X className="h-7 w-7" strokeWidth={2.5} />
                <span className="text-base">Failed</span>
              </button>
            </div>
          </div>

          {/* Number of prints — stepper */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">How many prints?</Label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrintCount((c) => Math.max(1, c - 1))}
                disabled={printCount <= 1}
                className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition active:scale-95 hover:bg-gray-200 disabled:opacity-40 disabled:active:scale-100"
                aria-label="Decrease"
              >
                <Minus className="h-6 w-6" />
              </button>
              <div className="flex h-16 flex-1 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200">
                <span className="text-3xl font-bold text-gray-900">{printCount}</span>
              </div>
              <button
                onClick={() => setPrintCount((c) => c + 1)}
                className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition active:scale-95 hover:bg-gray-200"
                aria-label="Increase"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
            {status === 'success' && partsPerPrint > 1 && (
              <p className="text-center text-sm text-gray-500">
                Adds <span className="font-bold text-gray-900">{partsToAdd}</span> parts to inventory
              </p>
            )}
            {status === 'success' && partsPerPrint === 1 && printCount > 1 && (
              <p className="text-center text-sm text-gray-500">
                Adds <span className="font-bold text-gray-900">{partsToAdd}</span> parts to inventory
              </p>
            )}
          </div>

          {/* Printer */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Which printer? (optional)</Label>
            <Select value={printerId} onValueChange={setPrinterId}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Choose a printer" />
              </SelectTrigger>
              <SelectContent>
                {printers?.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id} className="text-base py-3">
                    {pr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Big beige Log Print button */}
        <button
          onClick={handleSubmit}
          disabled={logPrint.isPending}
          className="mt-2 flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-[#999184] text-lg font-bold text-white shadow-md transition active:scale-[0.98] hover:bg-[#878073] disabled:opacity-60 disabled:active:scale-100"
        >
          {logPrint.isPending ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-6 w-6" strokeWidth={2.5} />
              Log Print
            </>
          )}
        </button>

        <button
          onClick={handleClose}
          disabled={logPrint.isPending}
          className="mt-2 h-12 w-full rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
