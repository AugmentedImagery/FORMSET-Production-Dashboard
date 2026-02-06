'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats, Part, ProductionOrder, OrderPartAllocation } from '@/types/database';

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

      // Get print success rate from inventory_print_log (new system)
      const { data: printLog, error: logError } = await supabase
        .from('inventory_print_log')
        .select('status, quantity_printed')
        .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (logError) throw logError;

      const successCount = printLog?.filter((p: { status: string }) => p.status === 'success').length || 0;
      const totalPrints = printLog?.length || 0;
      const printSuccessRate = totalPrints > 0 ? (successCount / totalPrints) * 100 : 100;

      // Get inventory with part names for stock levels display
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select(`
          *,
          part:parts(*)
        `)
        .order('quantity_on_hand', { ascending: true })
        .limit(10);

      if (inventoryError) throw inventoryError;

      interface InventoryWithPart {
        id: string;
        quantity_on_hand: number;
        quantity_reserved: number;
        part: Part | null;
      }

      // Stock levels for display (top parts by name)
      const stockLevels = (inventoryData || [])
        .filter((inv: InventoryWithPart) => inv.part)
        .map((inv: InventoryWithPart) => ({
          id: inv.id,
          name: inv.part?.name || 'Unknown',
          quantity: inv.quantity_on_hand,
        }));

      // Low stock parts (keep for alerts)
      const lowStockParts = (inventoryData || [])
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

      // Get unfulfilled order allocations (replaces print_jobs for production queue)
      const { data: allocations, error: allocError } = await supabase
        .from('order_part_allocations')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(id, priority, status, product:products(*))
        `)
        .in('status', ['pending', 'partially_allocated'])
        .limit(20);

      if (allocError) throw allocError;

      // Filter out cancelled orders and group by part for display
      interface AllocationWithOrder {
        id: string;
        part_id: string;
        quantity_needed: number;
        quantity_allocated: number;
        status: string;
        part: Part | null;
        production_order: { id: string; priority: string; status: string; product: unknown } | null;
      }

      const validAllocations = (allocations || []).filter(
        (a: AllocationWithOrder) => a.production_order?.status !== 'cancelled'
      );

      // Aggregate by part (combine all allocations for same part)
      const partMap = new Map<string, {
        part: Part;
        quantity_needed: number;
        quantity_allocated: number;
        order_count: number;
      }>();

      for (const alloc of validAllocations as AllocationWithOrder[]) {
        if (!alloc.part) continue;
        const existing = partMap.get(alloc.part_id);
        if (existing) {
          existing.quantity_needed += alloc.quantity_needed;
          existing.quantity_allocated += alloc.quantity_allocated;
          existing.order_count += 1;
        } else {
          partMap.set(alloc.part_id, {
            part: alloc.part,
            quantity_needed: alloc.quantity_needed,
            quantity_allocated: alloc.quantity_allocated,
            order_count: 1,
          });
        }
      }

      // Convert to array sorted by deficit (most needed first)
      const productionQueue = Array.from(partMap.values())
        .map(item => ({
          id: item.part.id,
          part: item.part,
          quantity_needed: item.quantity_needed,
          quantity_completed: item.quantity_allocated,
          order_count: item.order_count,
        }))
        .sort((a, b) => (b.quantity_needed - b.quantity_completed) - (a.quantity_needed - a.quantity_completed))
        .slice(0, 10);

      return {
        pendingOrders,
        inProductionOrders,
        totalPartsInStock,
        printSuccessRate,
        lowStockParts,
        stockLevels,
        recentOrders: recentOrders as ProductionOrder[],
        productionQueue,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export interface EnrichedPrintLogEntry {
  id: string;
  part_id: string;
  printer_id: string | null;
  gcode_filename: string | null;
  quantity_printed: number;
  status: string;
  source: string;
  completed_at: string;
  failure_reason: string | null;
  notes: string | null;
  part: { id: string; name: string; material_grams: number; parts_per_print: number; material_type: string } | null;
  printer: { id: string; name: string } | null;
  material_used_grams: number;
  num_prints: number;
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

      // Get inventory print log (new system) with part and printer data
      const { data: printLog, error: logError } = await supabase
        .from('inventory_print_log')
        .select(`
          *,
          part:parts(id, name, material_grams, parts_per_print, material_type),
          printer:printers(id, name)
        `)
        .gte('completed_at', startDate)
        .order('completed_at', { ascending: false });

      if (logError) throw logError;

      // Calculate material usage per log entry
      // material_grams on Part is PER PRINT (not per part)
      // So: material_used = (quantity_printed / parts_per_print) * material_grams
      interface PrintLogEntry {
        id: string;
        part_id: string;
        printer_id: string | null;
        gcode_filename: string | null;
        quantity_printed: number;
        status: string;
        source: string;
        completed_at: string;
        failure_reason: string | null;
        notes: string | null;
        part: { id: string; name: string; material_grams: number; parts_per_print: number; material_type: string } | null;
        printer: { id: string; name: string } | null;
      }

      const enrichedLog: EnrichedPrintLogEntry[] = (printLog || []).map((entry: PrintLogEntry) => {
        const partsPerPrint = entry.part?.parts_per_print || 1;
        const materialPerPrint = entry.part?.material_grams || 0;
        // For successful prints: number of prints = parts produced / parts_per_print
        // For failed prints: assume 1 print attempt (material was used but no parts produced)
        const numPrints = entry.status === 'success' && entry.quantity_printed > 0
          ? entry.quantity_printed / partsPerPrint
          : (entry.status === 'failed' ? 1 : 0);
        const materialUsed = numPrints * materialPerPrint;

        return {
          ...entry,
          material_used_grams: materialUsed,
          num_prints: numPrints,
        };
      });

      // Group by day for charts
      const dailyProduction: Record<string, { completed: number; failed: number; material: number }> = {};

      for (const entry of enrichedLog) {
        const day = entry.completed_at.split('T')[0];
        if (!dailyProduction[day]) {
          dailyProduction[day] = { completed: 0, failed: 0, material: 0 };
        }
        if (entry.status === 'success') {
          dailyProduction[day].completed += entry.num_prints;
        } else {
          dailyProduction[day].failed += entry.num_prints;
        }
        dailyProduction[day].material += entry.material_used_grams;
      }

      return {
        completedOrders: completedOrders || [],
        printLog: enrichedLog,
        dailyProduction,
      };
    },
  });
}
