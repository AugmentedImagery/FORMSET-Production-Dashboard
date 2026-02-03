'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { BambuPrinterState, Printer, PrintJob, Part, ProductionOrder } from '@/types/database';

// Extended printer type with joined Bambu state
export interface PrinterWithBambuState extends Omit<Printer, 'current_job' | 'bambu_state'> {
  current_job?: (PrintJob & {
    part?: Part;
    production_order?: ProductionOrder;
  }) | null;
  bambu_state?: BambuPrinterState | null;
}

/**
 * Fetch real-time state for a single printer.
 * Polls every 10 seconds to match the Python service update rate.
 */
export function useBambuPrinterState(printerId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['bambu_state', printerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bambu_printer_state')
        .select('*')
        .eq('printer_id', printerId)
        .single();

      // PGRST116 = no rows found, which is fine if printer hasn't been linked yet
      if (error && error.code !== 'PGRST116') throw error;
      return data as BambuPrinterState | null;
    },
    refetchInterval: 10000, // Poll every 10 seconds
    enabled: !!printerId,
  });
}

/**
 * Fetch real-time state for all printers.
 * Polls every 10 seconds to match the Python service update rate.
 */
export function useBambuPrinterStates() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['bambu_states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bambu_printer_state')
        .select('*');

      if (error) throw error;
      return data as BambuPrinterState[];
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

/**
 * Fetch printers with their Bambu state joined.
 * This is useful for the printers page to show both printer info and real-time state.
 */
export function usePrintersWithBambuState() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['printers_with_bambu_state'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select(`
          *,
          current_job:print_jobs!fk_printers_current_job(
            *,
            part:parts(*),
            production_order:production_orders(*)
          ),
          bambu_state:bambu_printer_state(*)
        `)
        .order('name');

      if (error) throw error;
      return data as PrinterWithBambuState[];
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

/**
 * Link a printer to a Bambu device ID.
 */
export function useLinkPrinterToBambu() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      printerId,
      bambuDeviceId,
    }: {
      printerId: string;
      bambuDeviceId: string;
    }) => {
      const { data, error } = await supabase
        .from('printers')
        .update({ bambu_device_id: bambuDeviceId })
        .eq('id', printerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      queryClient.invalidateQueries({ queryKey: ['printers_with_bambu_state'] });
    },
  });
}

/**
 * Unlink a printer from Bambu (remove device ID).
 */
export function useUnlinkPrinterFromBambu() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (printerId: string) => {
      // First, delete the bambu_printer_state record if it exists
      await supabase
        .from('bambu_printer_state')
        .delete()
        .eq('printer_id', printerId);

      // Then, clear the bambu_device_id on the printer
      const { data, error } = await supabase
        .from('printers')
        .update({ bambu_device_id: null, bambu_access_token: null })
        .eq('id', printerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers'] });
      queryClient.invalidateQueries({ queryKey: ['printers_with_bambu_state'] });
      queryClient.invalidateQueries({ queryKey: ['bambu_states'] });
    },
  });
}

/**
 * Helper to format temperature display.
 */
export function formatTemperature(
  current: number | null,
  target: number | null
): string {
  if (current === null) return '--';
  if (target === null || target === 0) return `${Math.round(current)}°C`;
  return `${Math.round(current)}°C / ${Math.round(target)}°C`;
}

/**
 * Helper to format time remaining.
 */
export function formatTimeRemaining(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '--';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Helper to get Bambu gcode_state as a readable string.
 */
export function formatGcodeState(state: string | null): string {
  if (!state) return 'Unknown';
  const stateMap: Record<string, string> = {
    IDLE: 'Idle',
    RUNNING: 'Printing',
    PREPARE: 'Preparing',
    PAUSE: 'Paused',
    FINISH: 'Finished',
    FAILED: 'Failed',
  };
  return stateMap[state] || state;
}
