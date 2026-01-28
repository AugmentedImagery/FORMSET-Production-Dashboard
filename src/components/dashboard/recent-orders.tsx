'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ProductionOrder } from '@/types/database';
import { ArrowRight, Package, Leaf } from 'lucide-react';

interface RecentOrdersProps {
  orders: ProductionOrder[];
}

// Product image placeholder with type-based styling
function ProductImage({ product }: { product: ProductionOrder['product'] }) {
  const type = product?.type || 'kiosk';
  const name = product?.name || 'Product';

  // Use different colors based on product type
  const bgColor = type === 'planter' ? 'bg-emerald-100' : 'bg-gray-800';
  const iconColor = type === 'planter' ? 'text-emerald-600' : 'text-gray-300';

  return (
    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${bgColor}`}>
      {type === 'planter' ? (
        <Leaf className={`h-6 w-6 ${iconColor}`} />
      ) : (
        <Package className={`h-6 w-6 ${iconColor}`} />
      )}
    </div>
  );
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
        </div>
        <div className="text-center py-8 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No orders yet</p>
          <Link
            href="/dashboard/orders"
            className="text-gray-600 hover:text-gray-900 mt-4 inline-block"
          >
            Create Order →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
        <Link
          href="/dashboard/orders"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          view all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            className="flex items-center gap-4 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
          >
            {/* Product image */}
            <ProductImage product={order.product} />

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {order.product?.name || 'Unknown Product'}
              </p>
              <p className="text-sm text-gray-400">
                <span className="font-medium text-gray-500">Qty: {order.quantity}</span>
                <span className="mx-2">·</span>
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
