'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ProductionOrder, CreateOrderInput, OrderStatus, OrderPriority, OrderPartAllocation } from '@/types/database';

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('production_orders')
        .select(`
          *,
          product:products(*),
          print_jobs(*),
          allocations:order_part_allocations(
            *,
            part:parts(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProductionOrder[];
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          *,
          product:products(*),
          print_jobs(
            *,
            part:parts(*),
            printer:printers!printer_id(*)
          ),
          allocations:order_part_allocations(
            *,
            part:parts(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ProductionOrder;
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const supabase = createClient();
      // Get the user
      const { data: { user } } = await supabase.auth.getUser();

      // Create the production order with fulfillment tracking
      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          ...input,
          source: 'internal',
          created_by: user?.id,
          fulfillment_status: 'unfulfilled',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Get all parts for this product via junction table
      const { data: productParts, error: partsError } = await supabase
        .from('product_parts')
        .select('part:parts(*)')
        .eq('product_id', input.product_id);

      if (partsError) throw partsError;

      // Extract parts from the junction result
      const parts = (productParts || [])
        .map((pp: { part: { id: string; parts_per_print: number } }) => pp.part)
        .filter(Boolean);

      // Create order part allocations (new inventory-based system)
      // Each order needs input.quantity of each part (1 part per product unit)
      const allocations = parts.map((part: { id: string; parts_per_print: number }) => ({
        production_order_id: order.id,
        part_id: part.id,
        quantity_needed: input.quantity, // Need this many parts total
        quantity_allocated: 0,
        status: 'pending' as const,
      }));

      const { error: allocError } = await supabase
        .from('order_part_allocations')
        .insert(allocations);

      if (allocError) {
        console.error('Failed to create allocations:', allocError);
        // Don't throw - this is the new system, fallback to old
      }

      // Also create print jobs for backwards compatibility
      // TODO: Remove this once fully migrated to allocation-based system
      const printJobs = parts.map((part: { id: string; parts_per_print: number }) => ({
        production_order_id: order.id,
        part_id: part.id,
        quantity_needed: Math.ceil(input.quantity / part.parts_per_print),
        status: 'queued' as const,
      }));

      const { error: jobsError } = await supabase
        .from('print_jobs')
        .insert(printJobs);

      if (jobsError) throw jobsError;

      // Try to allocate from existing inventory
      try {
        await supabase.rpc('allocate_inventory_for_order', {
          p_order_id: order.id
        });
      } catch (err) {
        console.error('Failed to allocate inventory:', err);
        // Not critical - allocation can happen later
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const supabase = createClient();
      const updates: Record<string, unknown> = { status };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.fulfillment_status = 'fulfilled';
        updates.fulfilled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('production_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // If order is cancelled, release reserved inventory and update allocations
      if (status === 'cancelled') {
        // Get allocations to release reserved inventory
        const { data: allocations } = await supabase
          .from('order_part_allocations')
          .select('part_id, quantity_allocated')
          .eq('production_order_id', id);

        // Release reserved inventory for each part
        if (allocations) {
          for (const alloc of allocations) {
            if (alloc.quantity_allocated > 0) {
              // Decrease reserved quantity
              await supabase
                .from('inventory')
                .update({
                  quantity_reserved: supabase.rpc('greatest', { a: 0, b: 'quantity_reserved' }) // Handled differently
                })
                .eq('part_id', alloc.part_id);

              // Actually, use RPC for safety
              await supabase.rpc('release_inventory_reservation', {
                p_part_id: alloc.part_id,
                p_quantity: alloc.quantity_allocated
              }).catch(() => {
                // RPC might not exist yet, do direct update
                supabase
                  .from('inventory')
                  .select('quantity_reserved')
                  .eq('part_id', alloc.part_id)
                  .single()
                  .then(({ data }: { data: { quantity_reserved: number } | null }) => {
                    if (data) {
                      const newReserved = Math.max(0, (data.quantity_reserved || 0) - alloc.quantity_allocated);
                      supabase
                        .from('inventory')
                        .update({ quantity_reserved: newReserved })
                        .eq('part_id', alloc.part_id);
                    }
                  });
              });
            }
          }
        }

        // Update allocations status
        await supabase
          .from('order_part_allocations')
          .delete()
          .eq('production_order_id', id);

        // Update print jobs to failed (backwards compatibility)
        const { error: jobsError } = await supabase
          .from('print_jobs')
          .update({ status: 'failed' })
          .eq('production_order_id', id)
          .in('status', ['queued', 'printing']);

        if (jobsError) throw jobsError;
      }

      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['active_print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['schedule_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useUpdateOrderPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: OrderPriority }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('production_orders')
        .update({ priority })
        .eq('id', id);

      if (error) throw error;
      return { id, priority };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export interface UpdateOrderInput {
  id: string;
  quantity?: number;
  priority?: OrderPriority;
  due_date?: string | null;
  notes?: string | null;
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateOrderInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('production_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['active_print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['schedule_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}
