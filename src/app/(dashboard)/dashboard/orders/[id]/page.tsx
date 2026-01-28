'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useLogPrint } from '@/hooks/usePrintJobs';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ShoppingBag,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  Plus,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PrintJob } from '@/types/database';

interface LogPrintDialogProps {
  open: boolean;
  onClose: () => void;
  job: PrintJob;
}

function LogPrintDialog({ open, onClose, job }: LogPrintDialogProps) {
  const [completed, setCompleted] = useState(1);
  const [failed, setFailed] = useState(0);
  const [notes, setNotes] = useState('');
  const logPrint = useLogPrint();

  const remaining = job.quantity_needed - job.quantity_completed;
  const maxCanLog = remaining;

  const handleSubmit = async () => {
    if (completed + failed > maxCanLog) {
      toast.error(`Cannot log more than ${maxCanLog} prints`);
      return;
    }

    try {
      await logPrint.mutateAsync({
        print_job_id: job.id,
        quantity_completed: completed,
        quantity_failed: failed,
        notes: notes || undefined,
      });
      toast.success('Print logged successfully');
      onClose();
      setCompleted(1);
      setFailed(0);
      setNotes('');
    } catch {
      toast.error('Failed to log print');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Print Result</DialogTitle>
          <DialogDescription>
            Record completed and failed prints for {job.part?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span>Needed:</span>
              <span className="font-medium">{job.quantity_needed}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="font-medium">{job.quantity_completed}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className="font-medium">{remaining}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Successful Prints</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCompleted(Math.max(0, completed - 1))}
                disabled={completed <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="0"
                max={maxCanLog}
                value={completed}
                onChange={(e) => setCompleted(parseInt(e.target.value) || 0)}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCompleted(Math.min(maxCanLog, completed + 1))}
                disabled={completed >= maxCanLog}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Failed Prints</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setFailed(Math.max(0, failed - 1))}
                disabled={failed <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="0"
                value={failed}
                onChange={(e) => setFailed(parseInt(e.target.value) || 0)}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setFailed(failed + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any issues or observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={logPrint.isPending || (completed === 0 && failed === 0)}
          >
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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canEdit } = useAuth();
  const { data: order, isLoading, error } = useOrder(params.id as string);
  const updateStatus = useUpdateOrderStatus();
  const [loggingJob, setLoggingJob] = useState<PrintJob | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return 'bg-yellow-100 text-yellow-700';
      case 'in_production':
      case 'printing':
        return 'bg-[#999184]/20 text-[#7a756a]';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
      case 'failed':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-orange-600 font-medium">Error loading order</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        <p className="text-xs text-gray-400 mt-1">Order ID: {params.id}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found</p>
        <p className="text-xs text-gray-400 mt-1">Order ID: {params.id}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Calculate overall progress
  const totalNeeded = order.print_jobs?.reduce((sum, j) => sum + j.quantity_needed, 0) || 0;
  const totalCompleted = order.print_jobs?.reduce((sum, j) => sum + j.quantity_completed, 0) || 0;
  const overallProgress = totalNeeded > 0 ? Math.round((totalCompleted / totalNeeded) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Order {order.shopify_order_number || order.id.slice(0, 8)}
            </h1>
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status.replace('_', ' ')}
            </Badge>
            {order.priority === 'rush' && (
              <Badge className="bg-yellow-100 text-yellow-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Rush
              </Badge>
            )}
            {order.priority === 'critical' && (
              <Badge className="bg-orange-100 text-orange-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Critical
              </Badge>
            )}
          </div>
          <p className="text-gray-500">
            {order.product?.name} - Qty: {order.quantity}
          </p>
        </div>
        {canEdit && order.status === 'pending' && (
          <Button
            onClick={() => updateStatus.mutate({ id: order.id, status: 'in_production' })}
            disabled={updateStatus.isPending}
          >
            Start Production
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Print Jobs */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Print Jobs</span>
                <span className="text-sm font-normal text-gray-500">
                  {overallProgress}% complete
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall progress bar */}
              <div className="mb-6">
                <Progress value={overallProgress} className="h-2" />
              </div>

              {/* Individual jobs */}
              {order.print_jobs?.map((job) => {
                const progress = job.quantity_needed > 0
                  ? Math.round((job.quantity_completed / job.quantity_needed) * 100)
                  : 0;
                const isComplete = job.status === 'completed';

                return (
                  <div
                    key={job.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {job.part?.name}
                          </span>
                          <Badge
                            className={getStatusColor(job.status)}
                            variant="secondary"
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {job.part?.material_type} - {job.part?.color || 'Default'}
                        </p>
                      </div>
                      {canEdit && !isComplete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLoggingJob(job)}
                        >
                          Log Print
                        </Button>
                      )}
                      {isComplete && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="text-sm text-gray-600 whitespace-nowrap">
                        {job.quantity_completed} / {job.quantity_needed}
                        {job.quantity_failed > 0 && (
                          <span className="text-orange-600 ml-2">
                            ({job.quantity_failed} failed)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Part details */}
                    <div className="mt-3 flex gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {job.part?.print_time_minutes}m per print
                      </span>
                      <span>
                        {job.part?.parts_per_print} parts/print
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Order Details Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  order.source === 'shopify' ? 'bg-green-100' : 'bg-[#999184]/20'
                }`}>
                  {order.source === 'shopify' ? (
                    <ShoppingBag className="h-5 w-5 text-green-600" />
                  ) : (
                    <Building2 className="h-5 w-5 text-[#7a756a]" />
                  )}
                </div>
                <div>
                  <p className="font-medium capitalize">{order.source}</p>
                  <p className="text-sm text-gray-500">Order Source</p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Product</span>
                  <span className="font-medium">{order.product?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Quantity</span>
                  <span className="font-medium">{order.quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Priority</span>
                  <span className="font-medium capitalize">{order.priority}</span>
                </div>
                {order.due_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Due Date</span>
                    <span className="font-medium">
                      {format(new Date(order.due_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium">
                    {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                {order.completed_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Completed</span>
                    <span className="font-medium">
                      {format(new Date(order.completed_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}
              </div>

              {order.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Log Print Dialog */}
      {loggingJob && (
        <LogPrintDialog
          open={!!loggingJob}
          onClose={() => setLoggingJob(null)}
          job={loggingJob}
        />
      )}
    </div>
  );
}
