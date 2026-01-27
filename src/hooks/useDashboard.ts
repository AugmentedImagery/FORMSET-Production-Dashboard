'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats, Part, ProductionOrder, PrintJob } from '@/types/database';

export function useDashboardStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async (): Promise<DashboardStats> => {
      // Get order counts by status
      const { data: orders, error: ordersError } = await supabase
        .from('production_orders')
        .select('status');

      if (ordersError) throw ordersError;

      const pendingOrders = orders?.filter((o: { status: string }) => o.status === 'pending').length || 0;
      const inProductionOrders = orders?.filter((o: { status: string }) => o.status === 'in_production').length || 0;

      // Get total parts in stock
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('quantity_on_hand');

      if (invError) throw invError;

      const totalPartsInStock = inventory?.reduce((sum: number, i: { quantity_on_hand: number }) => sum + i.quantity_on_hand, 0) || 0;

      // Get print success rate from history (sum quantities)
      const { data: history, error: histError } = await supabase
        .from('print_history')
        .select('status, quantity')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (histError) throw histError;

      const successCount = history?.reduce((sum: number, h: { status: string; quantity: number }) =>
        h.status === 'success' ? sum + (h.quantity || 1) : sum, 0) || 0;
      const totalPrints = history?.reduce((sum: number, h: { quantity: number }) =>
        sum + (h.quantity || 1), 0) || 0;
      const printSuccessRate = totalPrints > 0 ? (successCount / totalPrints) * 100 : 100;

      // Get low stock parts
      const { data: lowStockData, error: lowStockError } = await supabase
        .from('inventory')
        .select(`
          *,
          part:parts(*)
        `);

      if (lowStockError) throw lowStockError;

      interface InventoryWithPart {
        quantity_on_hand: number;
        quantity_reserved: number;
        part: Part | null;
      }
      const lowStockParts = (lowStockData || [])
        .filter((inv: InventoryWithPart) => {
          const available = inv.quantity_on_hand - inv.quantity_reserved;
          return available < (inv.part?.low_stock_threshold || 0);
        })
        .map((inv: InventoryWithPart) => inv.part as Part);

      // Get recent orders
      const { data: recentOrders, error: recentError } = await supabase
        .from('production_orders')
        .select(`
          *,
          product:products(*)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      // Get active print jobs
      const { data: activeJobs, error: jobsError } = await supabase
        .from('print_jobs')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(*, product:products(*))
        `)
        .in('status', ['queued', 'printing'])
        .order('scheduled_start', { ascending: true, nullsFirst: false })
        .limit(10);

      if (jobsError) throw jobsError;

      return {
        pendingOrders,
        inProductionOrders,
        totalPartsInStock,
        printSuccessRate,
        lowStockParts,
        recentOrders: recentOrders as ProductionOrder[],
        activeJobs: activeJobs as PrintJob[],
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useProductionMetrics(days: number = 30) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['production_metrics', days],
    queryFn: async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get completed orders
      const { data: completedOrders, error: ordersError } = await supabase
        .from('production_orders')
        .select('completed_at, quantity')
        .eq('status', 'completed')
        .gte('completed_at', startDate);

      if (ordersError) throw ordersError;

      // Get print history
      const { data: printHistory, error: histError } = await supabase
        .from('print_history')
        .select('status, ended_at, material_used_grams, quantity')
        .gte('created_at', startDate);

      if (histError) throw histError;

      // Group by day for charts (sum quantities)
      const dailyProduction: Record<string, { completed: number; failed: number; material: number }> = {};

      printHistory?.forEach((print: { ended_at: string | null; status: string; material_used_grams: number | null; quantity: number | null }) => {
        if (!print.ended_at) return;
        const day = print.ended_at.split('T')[0];
        if (!dailyProduction[day]) {
          dailyProduction[day] = { completed: 0, failed: 0, material: 0 };
        }
        const qty = print.quantity || 1;
        if (print.status === 'success') {
          dailyProduction[day].completed += qty;
          dailyProduction[day].material += print.material_used_grams || 0;
        } else {
          dailyProduction[day].failed += qty;
        }
      });

      return {
        completedOrders: completedOrders || [],
        printHistory: printHistory || [],
        dailyProduction,
      };
    },
  });
}
