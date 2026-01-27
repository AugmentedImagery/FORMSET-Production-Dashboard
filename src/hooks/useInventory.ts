'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Inventory, Part } from '@/types/database';

export interface InventoryWithPart extends Inventory {
  part: Part & {
    products: Array<{ id: string; name: string; type: string }>;
  };
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          part:parts(
            *,
            product_parts(
              product:products(id, name, type)
            )
          )
        `)
        .order('quantity_on_hand', { ascending: true });

      if (error) throw error;

      // Transform to flatten products array
      const transformed = (data || []).map((item: {
        part: {
          product_parts: Array<{ product: { id: string; name: string; type: string } }>;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }) => {
        const products = item.part?.product_parts?.map(pp => pp.product).filter(Boolean) || [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { product_parts, ...partRest } = item.part || {};
        return {
          ...item,
          part: {
            ...partRest,
            products,
          },
        };
      });

      return transformed as InventoryWithPart[];
    },
  });
}

export function useLowStockParts() {
  return useQuery({
    queryKey: ['low_stock_parts'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          part:parts(
            *,
            product_parts(
              product:products(id, name, type)
            )
          )
        `);

      if (error) throw error;

      // Transform to flatten products array
      const transformed = (data || []).map((item: {
        part: {
          product_parts: Array<{ product: { id: string; name: string; type: string } }>;
          low_stock_threshold: number;
          [key: string]: unknown;
        };
        quantity_on_hand: number;
        quantity_reserved: number;
        [key: string]: unknown;
      }) => {
        const products = item.part?.product_parts?.map(pp => pp.product).filter(Boolean) || [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { product_parts, ...partRest } = item.part || {};
        return {
          ...item,
          part: {
            ...partRest,
            products,
          },
        };
      }) as InventoryWithPart[];

      // Filter parts where stock is below threshold
      const lowStock = transformed.filter(
        (inv) => inv.quantity_on_hand - inv.quantity_reserved < inv.part.low_stock_threshold
      );

      return lowStock;
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      partId,
      quantity,
      reason,
    }: {
      partId: string;
      quantity: number;
      reason?: string;
    }) => {
      const supabase = createClient();
      // Get current inventory
      const { data: current, error: fetchError } = await supabase
        .from('inventory')
        .select('quantity_on_hand')
        .eq('part_id', partId)
        .single();

      if (fetchError) throw fetchError;

      // Update inventory
      const { error } = await supabase
        .from('inventory')
        .update({
          quantity_on_hand: quantity,
          last_updated: new Date().toISOString(),
        })
        .eq('part_id', partId);

      if (error) throw error;

      // Get user
      const { data: { user } } = await supabase.auth.getUser();

      // Log the adjustment
      await supabase.from('inventory_adjustments').insert({
        part_id: partId,
        previous_quantity: current.quantity_on_hand,
        new_quantity: quantity,
        adjustment_type: 'manual',
        reason: reason || 'Manual adjustment',
        created_by: user?.id,
      });

      return { partId, quantity };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low_stock_parts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useInventoryAdjustments(partId?: string) {
  return useQuery({
    queryKey: ['inventory_adjustments', partId],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('inventory_adjustments')
        .select(`
          *,
          part:parts(name),
          user:user_profiles(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (partId) {
        query = query.eq('part_id', partId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
