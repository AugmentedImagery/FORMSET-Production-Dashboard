'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PrintJob, Printer } from '@/types/database';
import { autoScheduleJobs, ScheduledJob, DailySchedule } from '@/lib/scheduling';

export function useScheduleData() {
  const supabase = createClient();

  // Fetch all active print jobs
  const jobsQuery = useQuery({
    queryKey: ['schedule_jobs'],
    queryFn: async () => {
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
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PrintJob[];
    },
  });

  // Fetch all printers
  const printersQuery = useQuery({
    queryKey: ['schedule_printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Printer[];
    },
  });

  // Calculate the auto-schedule
  const schedule = useMemo(() => {
    if (!jobsQuery.data || !printersQuery.data) {
      return { scheduledJobs: [] as ScheduledJob[], dailySchedule: [] as DailySchedule[] };
    }

    return autoScheduleJobs(jobsQuery.data, printersQuery.data);
  }, [jobsQuery.data, printersQuery.data]);

  return {
    jobs: jobsQuery.data || [],
    printers: printersQuery.data || [],
    scheduledJobs: schedule.scheduledJobs,
    dailySchedule: schedule.dailySchedule,
    isLoading: jobsQuery.isLoading || printersQuery.isLoading,
    error: jobsQuery.error || printersQuery.error,
  };
}
