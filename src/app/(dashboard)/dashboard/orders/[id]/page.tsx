'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useOrder, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ShoppingBag,
  Building2,
  AlertTriangle,
  CheckCircle,
  Package,
  PackageCheck,
  Boxes,
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canEdit } = useAuth();
  const { data: order, isLoading, error } = useOrder(params.id as string);
  const updateStatus = useUpdateOrderStatus();

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

  // Calculate overall progress from allocations (new inventory-based system)
  const allocations = order.allocations || [];
  const totalNeeded = allocations.reduce((sum, a) => sum + a.quantity_needed, 0);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.quantity_allocated, 0);
  const overallProgress = totalNeeded > 0 ? Math.round((totalAllocated / totalNeeded) * 100) : 0;

  // Determine fulfillment status
  const getFulfillmentStatus = () => {
    if (order.fulfillment_status === 'fulfilled') return 'fulfilled';
    if (totalAllocated === 0) return 'unfulfilled';
    if (totalAllocated < totalNeeded) return 'partial';
    return 'fulfilled';
  };
  const fulfillmentStatus = getFulfillmentStatus();

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
        {/* Part Fulfillment */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5" />
                  <span>Part Fulfillment</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      fulfillmentStatus === 'fulfilled'
                        ? 'bg-green-100 text-green-700'
                        : fulfillmentStatus === 'partial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }
                    variant="secondary"
                  >
                    {fulfillmentStatus === 'fulfilled' && (
                      <PackageCheck className="h-3 w-3 mr-1" />
                    )}
                    {fulfillmentStatus === 'partial' && (
                      <Package className="h-3 w-3 mr-1" />
                    )}
                    {fulfillmentStatus === 'unfulfilled' && (
                      <Package className="h-3 w-3 mr-1" />
                    )}
                    {fulfillmentStatus === 'fulfilled' ? 'Fulfilled' : fulfillmentStatus === 'partial' ? 'Partial' : 'Unfulfilled'}
                  </Badge>
                  <span className="text-sm font-normal text-gray-500">
                    {overallProgress}% allocated
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall progress bar */}
              <div className="mb-6">
                <Progress value={overallProgress} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {totalAllocated} of {totalNeeded} parts allocated from inventory
                </p>
              </div>

              {/* No allocations warning */}
              {allocations.length === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800">No Part Allocations</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        This order was created before the inventory system was set up.
                        Allocations will be created when inventory is available.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Individual allocations */}
              {allocations.map((alloc) => {
                const progress = alloc.quantity_needed > 0
                  ? Math.round((alloc.quantity_allocated / alloc.quantity_needed) * 100)
                  : 0;
                const isComplete = alloc.status === 'allocated';
                const deficit = alloc.quantity_needed - alloc.quantity_allocated;

                return (
                  <div
                    key={alloc.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {alloc.part?.name}
                          </span>
                          <Badge
                            className={
                              alloc.status === 'allocated'
                                ? 'bg-green-100 text-green-700'
                                : alloc.status === 'partially_allocated'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }
                            variant="secondary"
                          >
                            {alloc.status === 'allocated' ? 'Allocated' :
                             alloc.status === 'partially_allocated' ? 'Partial' : 'Pending'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {alloc.part?.material_type} - {alloc.part?.color || 'Default'}
                        </p>
                      </div>
                      {isComplete && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="text-sm text-gray-600 whitespace-nowrap">
                        {alloc.quantity_allocated} / {alloc.quantity_needed}
                        {deficit > 0 && (
                          <span className="text-orange-600 ml-2">
                            ({deficit} needed)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Part details */}
                    <div className="mt-3 flex gap-4 text-sm text-gray-500">
                      <span>
                        {alloc.part?.parts_per_print} parts/print
                      </span>
                      {deficit > 0 && (
                        <span className="text-orange-600">
                          ~{Math.ceil(deficit / (alloc.part?.parts_per_print || 1))} prints needed
                        </span>
                      )}
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

    </div>
  );
}
