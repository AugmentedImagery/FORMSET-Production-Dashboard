'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductionOrder } from '@/types/database';
import { ClipboardList, ArrowRight, ShoppingBag, Building2 } from 'lucide-react';

interface RecentOrdersProps {
  orders: ProductionOrder[];
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'in_production':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-700">Critical</Badge>;
      case 'rush':
        return <Badge className="bg-orange-100 text-orange-700">Rush</Badge>;
      default:
        return null;
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No orders yet</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/dashboard/orders">Create Order</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Recent Orders
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/orders">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            {/* Source icon */}
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              order.source === 'shopify' ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {order.source === 'shopify' ? (
                <ShoppingBag className="h-5 w-5 text-green-600" />
              ) : (
                <Building2 className="h-5 w-5 text-blue-600" />
              )}
            </div>

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {order.product?.name || 'Unknown Product'}
                </span>
                {getPriorityBadge(order.priority)}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-500">
                  Qty: {order.quantity}
                </span>
                <span className="text-sm text-gray-400">
                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Status */}
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status.replace('_', ' ')}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
