'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { usePrinters, useCreatePrinter, useUpdatePrinterStatus, useDeletePrinter } from '@/hooks/usePrinters';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Printer,
  Plus,
  MoreVertical,
  Wifi,
  WifiOff,
  AlertCircle,
  Wrench,
  Play,
  Pause,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PrinterStatus } from '@/types/database';

function AddPrinterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const createPrinter = useCreatePrinter();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a printer name');
      return;
    }

    try {
      await createPrinter.mutateAsync({
        name: name.trim(),
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
      });
      toast.success('Printer added successfully');
      setOpen(false);
      setName('');
      setModel('');
      setSerialNumber('');
    } catch {
      toast.error('Failed to add printer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Printer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Printer</DialogTitle>
          <DialogDescription>
            Add a new printer to your fleet
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Printer Name</Label>
            <Input
              id="name"
              placeholder="e.g., Bambu X1C #1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model (optional)</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="X1C">Bambu Lab X1 Carbon</SelectItem>
                <SelectItem value="X1E">Bambu Lab X1E</SelectItem>
                <SelectItem value="P1S">Bambu Lab P1S</SelectItem>
                <SelectItem value="P1P">Bambu Lab P1P</SelectItem>
                <SelectItem value="A1">Bambu Lab A1</SelectItem>
                <SelectItem value="A1 Mini">Bambu Lab A1 Mini</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">Serial Number (optional)</Label>
            <Input
              id="serial"
              placeholder="Enter serial number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createPrinter.isPending}>
            {createPrinter.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Printer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PrintersPage() {
  const { canEdit, isAdmin } = useAuth();
  const { data: printers, isLoading, error } = usePrinters();
  const updateStatus = useUpdatePrinterStatus();
  const deletePrinter = useDeletePrinter();

  const getStatusIcon = (status: PrinterStatus) => {
    switch (status) {
      case 'idle':
        return <Wifi className="h-5 w-5 text-green-600" />;
      case 'printing':
        return <Play className="h-5 w-5 text-[#7a756a]" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'maintenance':
        return <Wrench className="h-5 w-5 text-yellow-600" />;
      case 'offline':
      default:
        return <WifiOff className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: PrinterStatus) => {
    switch (status) {
      case 'idle':
        return 'bg-green-100 text-green-700';
      case 'printing':
        return 'bg-[#999184]/20 text-[#7a756a]';
      case 'error':
        return 'bg-orange-100 text-orange-700';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-700';
      case 'offline':
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStatusChange = async (printerId: string, status: PrinterStatus) => {
    try {
      await updateStatus.mutateAsync({ id: printerId, status });
      toast.success(`Printer status updated to ${status}`);
    } catch {
      toast.error('Failed to update printer status');
    }
  };

  const handleDelete = async (printerId: string) => {
    if (!confirm('Are you sure you want to delete this printer?')) return;

    try {
      await deletePrinter.mutateAsync(printerId);
      toast.success('Printer deleted');
    } catch {
      toast.error('Failed to delete printer');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Printers</h1>
            <p className="text-gray-500">Manage your printer fleet</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Printers</h1>
            <p className="text-gray-500">Manage your printer fleet</p>
          </div>
          {canEdit && <AddPrinterDialog />}
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-orange-600 font-medium">Error loading printers</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group printers by status
  const activePrinters = printers?.filter((p) => p.status === 'printing') || [];
  const idlePrinters = printers?.filter((p) => p.status === 'idle') || [];
  const otherPrinters = printers?.filter((p) =>
    !['printing', 'idle'].includes(p.status)
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Printers</h1>
          <p className="text-gray-500">Manage your printer fleet</p>
        </div>
        {canEdit && <AddPrinterDialog />}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <Printer className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Printers</p>
              <p className="text-2xl font-bold">{printers?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Wifi className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Idle</p>
              <p className="text-2xl font-bold">{idlePrinters.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(153, 145, 132, 0.2)' }}>
              <Play className="h-6 w-6" style={{ color: '#999184' }} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Printing</p>
              <p className="text-2xl font-bold">{activePrinters.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <WifiOff className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Offline/Other</p>
              <p className="text-2xl font-bold">{otherPrinters.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printers grid */}
      {printers?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Printer className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No printers configured</p>
            <p className="text-sm text-gray-400 mt-1">Add a printer to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {printers?.map((printer) => {
            const currentJob = printer.current_job;
            const progress = currentJob
              ? Math.round(
                  (currentJob.quantity_completed / currentJob.quantity_needed) * 100
                )
              : 0;

            return (
              <Card key={printer.id} className="relative overflow-hidden">
                {/* Status indicator bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    printer.status === 'printing'
                      ? 'bg-[#999184]'
                      : printer.status === 'idle'
                      ? 'bg-green-500'
                      : printer.status === 'error'
                      ? 'bg-orange-500'
                      : 'bg-gray-300'
                  }`}
                />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(printer.status)}
                    <div>
                      <CardTitle className="text-base">{printer.name}</CardTitle>
                      {printer.model && (
                        <p className="text-sm text-gray-500">{printer.model}</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(printer.id, 'idle')}
                          disabled={printer.status === 'idle'}
                        >
                          <Wifi className="mr-2 h-4 w-4" />
                          Set Idle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(printer.id, 'maintenance')}
                          disabled={printer.status === 'maintenance'}
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          Set Maintenance
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(printer.id, 'offline')}
                          disabled={printer.status === 'offline'}
                        >
                          <WifiOff className="mr-2 h-4 w-4" />
                          Set Offline
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(printer.id)}
                              className="text-orange-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Printer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </CardHeader>
                <CardContent>
                  <Badge className={getStatusColor(printer.status)} variant="secondary">
                    {printer.status}
                  </Badge>

                  {currentJob && printer.status === 'printing' && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {currentJob.part?.name}
                      </p>
                      <Progress value={progress} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>
                          {currentJob.quantity_completed} / {currentJob.quantity_needed}
                        </span>
                        <span>{progress}%</span>
                      </div>
                    </div>
                  )}

                  {printer.last_heartbeat && (
                    <p className="text-xs text-gray-400 mt-4">
                      Last seen{' '}
                      {formatDistanceToNow(new Date(printer.last_heartbeat), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bambu Labs integration notice */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Printer className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Bambu Labs Integration</p>
              <p className="text-sm text-gray-600 mt-1">
                Automatic printer status tracking and print completion logging will be available in a future update. For now, manually update printer status and log prints from the order detail page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
