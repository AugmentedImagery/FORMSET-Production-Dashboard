'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Printer, PrinterStatus } from '@/types/database';

export function usePrinters() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select(`
          *,
          current_job:print_jobs!fk_printers_current_job(
            *,
            part:parts(*),
            production_order:production_orders(*)
          )
        `)
        .order('name');

      if (error) throw error;
      return data as Printer[];
    },
  });
}

export function useCreatePrinter() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; model?: string; serial_number?: string }) => {
      const { data, error } = await supabase
        .from('printers')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
  });
}

export function useUpdatePrinterStatus() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PrinterStatus }) => {
      const { data, error } = await supabase
        .from('printers')
        .update({ status, last_heartbeat: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
  });
}

export function useDeletePrinter() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
  });
}
