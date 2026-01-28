'use client';

import { useDashboardStats } from '@/hooks/useDashboard';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ProductionTimeline } from '@/components/dashboard/production-timeline';
import { StockLevels } from '@/components/dashboard/low-stock-alert';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32 mb-2" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <Skeleton className="h-6 w-36 mb-6" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
        <p className="text-orange-600 font-medium">Failed to load dashboard data</p>
        <p className="text-sm text-gray-400 mt-1">Please check your connection and try again</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          description="Waiting for scheduling"
        />
        <StatsCard
          title="In Progress Orders"
          value={stats?.inProductionOrders || 0}
          description="On the schedule"
        />
        <StatsCard
          title="Parts in Stock"
          value={stats?.totalPartsInStock?.toLocaleString() || '0'}
          description="Total Inventory"
        />
        <StatsCard
          title="Success Rate"
          value={`${stats?.printSuccessRate?.toFixed(1) || 100}%`}
          description="Last 30 days"
        />
      </div>

      {/* Production Queue, Recent Orders, and Stock Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Production Queue + Recent Orders stacked */}
        <div className="lg:col-span-2 space-y-6">
          <ProductionTimeline jobs={stats?.activeJobs || []} />
          <RecentOrders orders={stats?.recentOrders || []} />
        </div>
        {/* Right column: Stock Levels */}
        <div>
          <StockLevels items={stats?.stockLevels || []} />
        </div>
      </div>
    </div>
  );
}
