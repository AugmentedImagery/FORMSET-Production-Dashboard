'use client';

import { useDashboardStats } from '@/hooks/useDashboard';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ProductionTimeline } from '@/components/dashboard/production-timeline';
import { LowStockAlert } from '@/components/dashboard/low-stock-alert';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  ClipboardList,
  Printer,
  Package,
  TrendingUp,
} from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your production status</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your production status</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Failed to load dashboard data</p>
            <p className="text-sm text-gray-500 mt-1">Please check your connection and try again</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your production status</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          description="Awaiting production"
          icon={ClipboardList}
        />
        <StatsCard
          title="In Production"
          value={stats?.inProductionOrders || 0}
          description="Currently manufacturing"
          icon={Printer}
        />
        <StatsCard
          title="Parts in Stock"
          value={stats?.totalPartsInStock?.toLocaleString() || '0'}
          description="Total inventory"
          icon={Package}
        />
        <StatsCard
          title="Success Rate"
          value={`${stats?.printSuccessRate?.toFixed(1) || 100}%`}
          description="Last 30 days"
          icon={TrendingUp}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production timeline - takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <ProductionTimeline jobs={stats?.activeJobs || []} />
          <RecentOrders orders={stats?.recentOrders || []} />
        </div>

        {/* Sidebar - alerts and quick actions */}
        <div className="space-y-6">
          <LowStockAlert parts={stats?.lowStockParts || []} />
        </div>
      </div>
    </div>
  );
}
