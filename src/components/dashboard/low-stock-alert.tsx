'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Part } from '@/types/database';
import { AlertTriangle, Package, ArrowRight } from 'lucide-react';

interface LowStockAlertProps {
  parts: Part[];
}

export function LowStockAlert({ parts }: LowStockAlertProps) {
  if (parts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-800">All parts in stock</p>
              <p className="text-sm text-green-600">Inventory levels are healthy</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Low Stock Alert
        </CardTitle>
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          {parts.length} {parts.length === 1 ? 'part' : 'parts'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {parts.slice(0, 5).map((part) => (
          <div
            key={part.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
          >
            <div>
              <p className="font-medium text-gray-900">{part.name}</p>
              <p className="text-sm text-gray-500">
                Threshold: {part.low_stock_threshold} units
              </p>
            </div>
            <Badge variant="secondary" className="bg-red-100 text-red-700">
              Low
            </Badge>
          </div>
        ))}

        {parts.length > 5 && (
          <p className="text-sm text-orange-700 text-center">
            +{parts.length - 5} more parts below threshold
          </p>
        )}

        <Button variant="outline" className="w-full mt-2" asChild>
          <Link href="/dashboard/inventory">
            View Inventory
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
