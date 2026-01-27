'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PrintJob, PrintJobStatus, LogPrintInput } from '@/types/database';

export function usePrintJobs(status?: PrintJobStatus) {
  return useQuery({
    queryKey: ['print_jobs', status],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('print_jobs')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(
            *,
            product:products(*)
          ),
          printer:printers!printer_id(*)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PrintJob[];
    },
  });
}

export function useActivePrintJobs() {
  return useQuery({
    queryKey: ['active_print_jobs'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('print_jobs')
        .select(`
          *,
          part:parts(*),
          production_order:production_orders(
            *,
            product:products(*)
          ),
          printer:printers!printer_id(*)
        `)
        .in('status', ['queued', 'printing'])
        .order('scheduled_start', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as PrintJob[];
    },
  });
}

export function useLogPrint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogPrintInput) => {
      const supabase = createClient();
      // Get current print job
      const { data: currentJob, error: fetchError } = await supabase
        .from('print_jobs')
        .select('*, part:parts(*)')
        .eq('id', input.print_job_id)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new totals
      const newCompleted = currentJob.quantity_completed + input.quantity_completed;
      const newFailed = currentJob.quantity_failed + input.quantity_failed;
      const isComplete = newCompleted >= currentJob.quantity_needed;

      // Update print job
      const { error } = await supabase
        .from('print_jobs')
        .update({
          quantity_completed: newCompleted,
          quantity_failed: newFailed,
          status: isComplete ? 'completed' : 'printing',
          printer_id: input.printer_id || currentJob.printer_id,
          actual_start: currentJob.actual_start || new Date().toISOString(),
          actual_end: isComplete ? new Date().toISOString() : null,
          notes: input.notes ? `${currentJob.notes || ''}\n${input.notes}`.trim() : currentJob.notes,
        })
        .eq('id', input.print_job_id);

      if (error) throw error;

      // Log to print history - create separate records for success and failed with quantities
      const historyRecords = [];
      const now = new Date().toISOString();

      if (input.quantity_completed > 0) {
        historyRecords.push({
          print_job_id: input.print_job_id,
          printer_id: input.printer_id,
          part_id: currentJob.part_id,
          status: 'success' as const,
          quantity: input.quantity_completed,
          started_at: now,
          ended_at: now,
          failure_reason: null,
          material_used_grams: currentJob.part.material_grams * input.quantity_completed,
        });
      }

      if (input.quantity_failed > 0) {
        historyRecords.push({
          print_job_id: input.print_job_id,
          printer_id: input.printer_id,
          part_id: currentJob.part_id,
          status: 'failed' as const,
          quantity: input.quantity_failed,
          started_at: now,
          ended_at: now,
          failure_reason: input.notes || null,
          material_used_grams: 0, // Failed prints don't contribute usable material
        });
      }

      if (historyRecords.length > 0) {
        await supabase.from('print_history').insert(historyRecords);
      }

      // Check if all print jobs for the order are complete
      if (isComplete) {
        const { data: allJobs } = await supabase
          .from('print_jobs')
          .select('status')
          .eq('production_order_id', currentJob.production_order_id);

        const allComplete = allJobs?.every((j: { status: string }) => j.status === 'completed');

        if (allComplete) {
          await supabase
            .from('production_orders')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', currentJob.production_order_id);
        }
      }

      return { print_job_id: input.print_job_id, isComplete };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['active_print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useUpdatePrintJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PrintJobStatus }) => {
      const supabase = createClient();
      const updates: Partial<PrintJob> = { status };

      if (status === 'printing') {
        updates.actual_start = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updates.actual_end = new Date().toISOString();
      }

      const { error } = await supabase
        .from('print_jobs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['active_print_jobs'] });
    },
  });
}
