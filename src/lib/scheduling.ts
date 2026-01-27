import { PrintJob, Printer } from '@/types/database';
import { addDays, startOfDay, isWeekend, isBefore, isAfter, format } from 'date-fns';

export interface ScheduledJob extends PrintJob {
  scheduledDate: Date;
  estimatedEndDate: Date;
  isPastDeadline: boolean;
  assignedPrinter?: Printer;
}

export interface DailySchedule {
  date: Date;
  jobs: ScheduledJob[];
  totalMinutes: number;
  availableMinutes: number;
  printerCount: number;
}

const WORK_HOURS_PER_DAY = 8;
const MINUTES_PER_WORK_DAY = WORK_HOURS_PER_DAY * 60;

/**
 * Calculate the total print time needed for a job
 * Accounts for quantity needed, quantity completed, and parts per print
 */
function calculateJobPrintTime(job: PrintJob): number {
  const remaining = job.quantity_needed - job.quantity_completed;
  if (remaining <= 0) return 0;

  const printTimePerBatch = job.part?.print_time_minutes || 60;
  return remaining * printTimePerBatch;
}

/**
 * Get the next working day (skip weekends)
 */
function getNextWorkDay(date: Date): Date {
  let nextDay = addDays(date, 1);
  while (isWeekend(nextDay)) {
    nextDay = addDays(nextDay, 1);
  }
  return nextDay;
}

/**
 * Check if a date is a working day (not weekend)
 */
function isWorkDay(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Get the available printers (not offline, error, or maintenance)
 */
export function getAvailablePrinters(printers: Printer[]): Printer[] {
  return printers.filter(p =>
    p.status === 'idle' || p.status === 'printing'
  );
}

/**
 * Auto-schedule print jobs based on available printers and 8-hour workdays
 *
 * Algorithm:
 * 1. Sort jobs by priority (critical > rush > normal) and order due date
 * 2. For each day, calculate available capacity (printers × 8 hours)
 * 3. Assign jobs to days until capacity is filled
 * 4. Flag jobs that would complete after their order's due date
 */
export function autoScheduleJobs(
  jobs: PrintJob[],
  printers: Printer[],
  startDate: Date = new Date()
): { scheduledJobs: ScheduledJob[]; dailySchedule: DailySchedule[] } {
  const availablePrinters = getAvailablePrinters(printers);
  const printerCount = Math.max(availablePrinters.length, 1); // At least 1 for calculation

  // Daily capacity in minutes (all printers can work in parallel)
  const dailyCapacity = MINUTES_PER_WORK_DAY * printerCount;

  // Filter to only queued/printing jobs and sort by priority
  const priorityOrder = { critical: 0, rush: 1, normal: 2 };
  const jobsToSchedule = jobs
    .filter(j => j.status === 'queued' || j.status === 'printing')
    .filter(j => (j.quantity_needed - j.quantity_completed) > 0)
    .sort((a, b) => {
      // First by priority
      const priorityA = priorityOrder[a.production_order?.priority || 'normal'];
      const priorityB = priorityOrder[b.production_order?.priority || 'normal'];
      if (priorityA !== priorityB) return priorityA - priorityB;

      // Then by due date (earlier first, nulls last)
      const dueDateA = a.production_order?.due_date ? new Date(a.production_order.due_date) : null;
      const dueDateB = b.production_order?.due_date ? new Date(b.production_order.due_date) : null;

      if (dueDateA && dueDateB) return dueDateA.getTime() - dueDateB.getTime();
      if (dueDateA) return -1;
      if (dueDateB) return 1;

      // Finally by creation date
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const scheduledJobs: ScheduledJob[] = [];
  const dailyScheduleMap = new Map<string, DailySchedule>();

  // Start from today or next workday if today is weekend
  let currentDate = startOfDay(startDate);
  if (!isWorkDay(currentDate)) {
    currentDate = getNextWorkDay(currentDate);
  }

  let remainingCapacityToday = dailyCapacity;

  for (const job of jobsToSchedule) {
    const printTime = calculateJobPrintTime(job);
    if (printTime <= 0) continue;

    let remainingTime = printTime;
    const jobStartDate = currentDate;

    // Assign this job starting from current date
    while (remainingTime > 0) {
      // Skip weekends
      while (!isWorkDay(currentDate)) {
        currentDate = getNextWorkDay(currentDate);
        remainingCapacityToday = dailyCapacity;
      }

      // If no capacity left today, move to next day
      if (remainingCapacityToday <= 0) {
        currentDate = getNextWorkDay(currentDate);
        remainingCapacityToday = dailyCapacity;
      }

      // How much of this job can we do today?
      const timeToday = Math.min(remainingTime, remainingCapacityToday);

      // Get or create daily schedule for this date
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      if (!dailyScheduleMap.has(dateKey)) {
        dailyScheduleMap.set(dateKey, {
          date: currentDate,
          jobs: [],
          totalMinutes: 0,
          availableMinutes: dailyCapacity,
          printerCount,
        });
      }

      remainingTime -= timeToday;
      remainingCapacityToday -= timeToday;

      const daySchedule = dailyScheduleMap.get(dateKey)!;
      daySchedule.totalMinutes += timeToday;
      daySchedule.availableMinutes = dailyCapacity - daySchedule.totalMinutes;

      // If job spans multiple days, keep going
      if (remainingTime > 0) {
        currentDate = getNextWorkDay(currentDate);
        remainingCapacityToday = dailyCapacity;
      }
    }

    // Job ends on currentDate
    const jobEndDate = currentDate;

    // Check if past deadline
    const dueDate = job.production_order?.due_date
      ? new Date(job.production_order.due_date)
      : null;
    const isPastDeadline = dueDate ? isAfter(jobEndDate, startOfDay(dueDate)) : false;

    const scheduledJob: ScheduledJob = {
      ...job,
      scheduledDate: jobStartDate,
      estimatedEndDate: jobEndDate,
      isPastDeadline,
    };

    scheduledJobs.push(scheduledJob);

    // Add to the start day's schedule for display
    const startDateKey = format(jobStartDate, 'yyyy-MM-dd');
    const startDaySchedule = dailyScheduleMap.get(startDateKey);
    if (startDaySchedule) {
      startDaySchedule.jobs.push(scheduledJob);
    }
  }

  // Convert map to sorted array
  const dailySchedule = Array.from(dailyScheduleMap.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return { scheduledJobs, dailySchedule };
}

/**
 * Get jobs scheduled for a specific date
 */
export function getJobsForDate(
  scheduledJobs: ScheduledJob[],
  date: Date
): ScheduledJob[] {
  const targetDate = startOfDay(date);
  return scheduledJobs.filter(job => {
    const jobStart = startOfDay(job.scheduledDate);
    const jobEnd = startOfDay(job.estimatedEndDate);
    return (
      (jobStart.getTime() <= targetDate.getTime() &&
       targetDate.getTime() <= jobEnd.getTime())
    );
  });
}

/**
 * Format minutes as hours and minutes
 */
export function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
