'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ProductionOrder, CreateOrderInput, OrderStatus, OrderPriority } from '@/types/database';

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
          print_jobs(*)
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

      // Create the production order
      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          ...input,
          source: 'internal',
          created_by: user?.id,
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

      // Create print jobs for each part
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

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const supabase = createClient();
      const updates: Partial<ProductionOrder> = { status };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('production_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // If order is cancelled, also update all print jobs to 'failed' status
      // so they don't appear in the schedule anymore
      if (status === 'cancelled') {
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
