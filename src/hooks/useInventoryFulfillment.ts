'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  GcodePartMapping,
  OrderPartAllocation,
  InventoryPrintLog,
  PartDemand,
  CreateGcodeMappingInput,
  LogInventoryPrintInput,
  Part,
} from '@/types/database';

// ============================================================================
// GCODE MAPPINGS
// ============================================================================

/**
 * Fetch all gcode to part mappings.
 */
export function useGcodeMappings() {
  return useQuery({
    queryKey: ['gcode_mappings'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('gcode_part_mappings')
        .select(`
          *,
          part:parts(*)
        `)
        .order('gcode_filename');

      if (error) throw error;
      return data as GcodePartMapping[];
    },
  });
}

/**
 * Fetch gcode mappings for a specific part.
 */
export function useGcodeMappingsForPart(partId: string) {
  return useQuery({
    queryKey: ['gcode_mappings', 'part', partId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('gcode_part_mappings')
        .select('*')
        .eq('part_id', partId)
        .order('gcode_filename');

      if (error) throw error;
      return data as GcodePartMapping[];
    },
    enabled: !!partId,
  });
}

/**
 * Create a new gcode mapping.
 */
export function useCreateGcodeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGcodeMappingInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('gcode_part_mappings')
        .insert({
          gcode_filename: input.gcode_filename,
          part_id: input.part_id,
          notes: input.notes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GcodePartMapping;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcode_mappings'] });
    },
  });
}

/**
 * Delete a gcode mapping.
 */
export function useDeleteGcodeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('gcode_part_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcode_mappings'] });
    },
  });
}

/**
 * Toggle a gcode mapping active/inactive.
 */
export function useToggleGcodeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('gcode_part_mappings')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcode_mappings'] });
    },
  });
}

// ============================================================================
// ORDER ALLOCATIONS
// ============================================================================

/**
 * Fetch allocations for a specific order.
 */
export function useOrderAllocations(orderId: string) {
  return useQuery({
    queryKey: ['order_allocations', orderId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('order_part_allocations')
        .select(`
          *,
          part:parts(*)
        `)
        .eq('production_order_id', orderId);

      if (error) throw error;
      return data as OrderPartAllocation[];
    },
    enabled: !!orderId,
  });
}

/**
 * Fetch all pending/partial allocations (for demand view).
 */
export function usePendingAllocations() {
  return useQuery({
    queryKey: ['pending_allocations'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('order_part_allocations')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(*)
        `)
        .in('status', ['pending', 'partially_allocated']);

      if (error) throw error;
      return data as OrderPartAllocation[];
    },
  });
}

// ============================================================================
// INVENTORY PRINT LOG
// ============================================================================

/**
 * Fetch recent print log entries.
 */
export function useInventoryPrintLog(limit = 50) {
  return useQuery({
    queryKey: ['inventory_print_log', limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('inventory_print_log')
        .select(`
          *,
          part:parts(*),
          printer:printers(*)
        `)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as InventoryPrintLog[];
    },
  });
}

/**
 * Log a manual print to inventory.
 */
export function useLogInventoryPrint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogInventoryPrintInput) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Insert print log entry
      const { data: logEntry, error: logError } = await supabase
        .from('inventory_print_log')
        .insert({
          part_id: input.part_id,
          printer_id: input.printer_id,
          gcode_filename: input.gcode_filename,
          quantity_printed: input.quantity_printed,
          status: input.status,
          source: 'manual',
          failure_reason: input.failure_reason,
          notes: input.notes,
          created_by: user?.id,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) throw logError;

      // If successful print, update inventory
      if (input.status === 'success' && input.quantity_printed > 0) {
        const { error: rpcError } = await supabase.rpc('increment_inventory', {
          p_part_id: input.part_id,
          p_quantity: input.quantity_printed,
        });

        if (rpcError) throw rpcError;
      }

      return logEntry as InventoryPrintLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_print_log'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['part_demand'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

// ============================================================================
// PART DEMAND (What needs to be printed)
// ============================================================================

/**
 * Fetch part demand from the database view.
 */
export function usePartDemand() {
  return useQuery({
    queryKey: ['part_demand'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('part_demand')
        .select('*')
        .gt('deficit', 0)
        .order('prints_required', { ascending: false });

      if (error) throw error;
      return data as PartDemand[];
    },
  });
}

/**
 * Calculate part demand with order details (more detailed than the view).
 */
export function useDetailedPartDemand() {
  return useQuery({
    queryKey: ['detailed_part_demand'],
    queryFn: async () => {
      const supabase = createClient();

      // Get all unfulfilled allocations grouped by part
      const { data: allocations, error: allocError } = await supabase
        .from('order_part_allocations')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(
            id, priority, due_date, created_at, status
          )
        `)
        .in('status', ['pending', 'partially_allocated']);

      if (allocError) throw allocError;

      // Get inventory
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('*');

      if (invError) throw invError;

      // Group by part and calculate demand
      const demandByPart = new Map<string, {
        part: Part;
        totalNeeded: number;
        availableInventory: number;
        deficit: number;
        printsRequired: number;
        orders: Array<{
          orderId: string;
          priority: string;
          dueDate: string | null;
          quantityNeeded: number;
        }>;
      }>();

      for (const alloc of allocations || []) {
        if (!alloc.part || alloc.production_order?.status === 'cancelled') continue;

        const partId = alloc.part_id;
        const unallocated = alloc.quantity_needed - alloc.quantity_allocated;

        if (!demandByPart.has(partId)) {
          const inv = inventory?.find((i: { part_id: string; quantity_on_hand: number; quantity_reserved: number }) => i.part_id === partId);
          demandByPart.set(partId, {
            part: alloc.part,
            totalNeeded: 0,
            availableInventory: Math.max(0, (inv?.quantity_on_hand || 0) - (inv?.quantity_reserved || 0)),
            deficit: 0,
            printsRequired: 0,
            orders: [],
          });
        }

        const demand = demandByPart.get(partId)!;
        demand.totalNeeded += unallocated;
        demand.orders.push({
          orderId: alloc.production_order_id,
          priority: alloc.production_order?.priority || 'normal',
          dueDate: alloc.production_order?.due_date || null,
          quantityNeeded: unallocated,
        });
      }

      // Calculate deficits
      for (const demand of demandByPart.values()) {
        demand.deficit = Math.max(0, demand.totalNeeded - demand.availableInventory);
        demand.printsRequired = Math.ceil(demand.deficit / (demand.part.parts_per_print || 1));
      }

      // Sort by priority then due date
      const priorityOrder = { critical: 0, rush: 1, normal: 2 };
      return Array.from(demandByPart.values())
        .filter(d => d.deficit > 0)
        .sort((a, b) => {
          const aPriority = Math.min(
            ...a.orders.map(o => priorityOrder[o.priority as keyof typeof priorityOrder] ?? 2)
          );
          const bPriority = Math.min(
            ...b.orders.map(o => priorityOrder[o.priority as keyof typeof priorityOrder] ?? 2)
          );
          if (aPriority !== bPriority) return aPriority - bPriority;

          const aDue = a.orders
            .filter(o => o.dueDate)
            .map(o => new Date(o.dueDate!).getTime())
            .sort()[0] || Infinity;
          const bDue = b.orders
            .filter(o => o.dueDate)
            .map(o => new Date(o.dueDate!).getTime())
            .sort()[0] || Infinity;

          return aDue - bDue;
        });
    },
  });
}
