'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  quantity: number;
}

interface StockLevelsProps {
  items: StockItem[];
}

export function StockLevels({ items }: StockLevelsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Stock Levels</h2>

      <div className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex items-center justify-between ${index === 0 ? 'pb-4' : 'py-4'}`}
          >
            <span className="text-gray-700">{item.name}</span>
            <span className="font-bold text-gray-900">{item.quantity}</span>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-gray-400 text-center py-4">No inventory data</p>
        )}
      </div>

      <Link
        href="/dashboard/inventory"
        className="flex items-center justify-end gap-1 text-gray-500 hover:text-gray-700 mt-4 text-sm"
      >
        View Inventory
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// Keep the old export name for backwards compatibility
export { StockLevels as LowStockAlert };
