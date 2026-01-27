'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, addDays, startOfWeek, isSameDay, isWeekend, startOfDay } from 'date-fns';
import { useScheduleData } from '@/hooks/useSchedule';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Printer,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ScheduledJob, getAvailablePrinters, formatPrintTime } from '@/lib/scheduling';

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { scheduledJobs, printers, isLoading, error } = useScheduleData();
  const { canEdit } = useAuth();

  // Get week dates (Monday to Sunday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get available printers count
  const availablePrinters = useMemo(() =>
    getAvailablePrinters(printers || []),
    [printers]
  );

  // Get jobs for a specific day
  const getJobsForDay = (date: Date): ScheduledJob[] => {
    const targetDate = startOfDay(date);
    return scheduledJobs.filter(job => {
      const jobStart = startOfDay(job.scheduledDate);
      const jobEnd = startOfDay(job.estimatedEndDate);
      return (
        jobStart.getTime() <= targetDate.getTime() &&
        targetDate.getTime() <= jobEnd.getTime()
      );
    });
  };

  // Calculate daily capacity usage
  const getDayCapacity = (date: Date) => {
    if (isWeekend(date)) return { used: 0, total: 0, percentage: 0 };

    const printerCount = Math.max(availablePrinters.length, 1);
    const totalMinutes = printerCount * 8 * 60; // 8 hours per printer
    const dayJobs = getJobsForDay(date);

    // Sum up print time for jobs on this day
    const usedMinutes = dayJobs.reduce((sum, job) => {
      const remaining = job.quantity_needed - job.quantity_completed;
      const printTimePerBatch = job.part?.print_time_minutes || 60;
      return sum + (remaining * printTimePerBatch);
    }, 0);

    return {
      used: Math.min(usedMinutes, totalMinutes),
      total: totalMinutes,
      percentage: Math.min(Math.round((usedMinutes / totalMinutes) * 100), 100),
    };
  };

  // Jobs past deadline
  const jobsPastDeadline = scheduledJobs.filter(job => job.isPastDeadline);

  const getStatusColor = (status: string, isPastDeadline: boolean) => {
    if (isPastDeadline) {
      return 'border-l-red-500 bg-red-50';
    }
    switch (status) {
      case 'printing':
        return 'border-l-blue-500 bg-blue-50';
      case 'queued':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'completed':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getPriorityIndicator = (priority: string) => {
    if (priority === 'critical') {
      return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
    }
    if (priority === 'rush') {
      return <div className="w-2 h-2 rounded-full bg-orange-500" />;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
            <p className="text-gray-500">Auto-scheduled based on printer capacity</p>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
            <p className="text-gray-500">Auto-scheduled based on printer capacity</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium">Error loading schedule</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
          <p className="text-gray-500">Auto-scheduled based on printer capacity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Capacity info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Printers</p>
              <p className="text-xl font-bold">{availablePrinters.length} of {printers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daily Capacity</p>
              <p className="text-xl font-bold">{availablePrinters.length * 8}h ({availablePrinters.length} × 8h)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              jobsPastDeadline.length > 0 ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                jobsPastDeadline.length > 0 ? 'text-red-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Jobs Past Deadline</p>
              <p className={`text-xl font-bold ${jobsPastDeadline.length > 0 ? 'text-red-600' : ''}`}>
                {jobsPastDeadline.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week header */}
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Calendar className="h-5 w-5" />
        {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
      </div>

      {/* Deadline warnings */}
      {jobsPastDeadline.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              Jobs Scheduled Past Deadline ({jobsPastDeadline.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {jobsPastDeadline.map((job) => (
                <Link
                  key={job.id}
                  href={`/dashboard/orders/${job.production_order_id}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-red-200 text-sm hover:bg-red-50 transition-colors"
                >
                  {getPriorityIndicator(job.production_order?.priority || 'normal')}
                  <span className="font-medium">{job.part?.name}</span>
                  <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                    Due: {job.production_order?.due_date
                      ? format(new Date(job.production_order.due_date), 'MMM d')
                      : 'N/A'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Est: {format(job.estimatedEndDate, 'MMM d')}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayJobs = getJobsForDay(day);
          const isToday = isSameDay(day, new Date());
          const isWeekendDay = isWeekend(day);
          const capacity = getDayCapacity(day);

          return (
            <Card
              key={day.toISOString()}
              className={`${isToday ? 'ring-2 ring-blue-500' : ''} ${isWeekendDay ? 'opacity-50' : ''}`}
            >
              <CardHeader className={`py-3 ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-gray-100' : 'bg-gray-50'}`}>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {format(day, 'EEE')}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </p>
                  {!isWeekendDay && (
                    <div className="mt-1">
                      <Progress
                        value={capacity.percentage}
                        className="h-1"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {capacity.percentage}% booked
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 min-h-[200px]">
                {isWeekendDay ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Weekend
                  </p>
                ) : dayJobs.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No jobs scheduled
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayJobs.map((job) => {
                      const progress = job.quantity_needed > 0
                        ? Math.round((job.quantity_completed / job.quantity_needed) * 100)
                        : 0;
                      const remaining = job.quantity_needed - job.quantity_completed;
                      const printTime = remaining * (job.part?.print_time_minutes || 60);

                      return (
                        <Link
                          key={job.id}
                          href={`/dashboard/orders/${job.production_order_id}`}
                          className={`block p-2 rounded border-l-4 ${getStatusColor(job.status, job.isPastDeadline)} hover:opacity-80 transition-opacity`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {getPriorityIndicator(job.production_order?.priority || 'normal')}
                            {job.isPastDeadline && (
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            )}
                            <span className="text-xs font-medium truncate">
                              {job.part?.name}
                            </span>
                          </div>
                          <Progress value={progress} className="h-1 mb-1" />
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{job.quantity_completed}/{job.quantity_needed}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatPrintTime(printTime)}
                            </span>
                          </div>
                          {job.status === 'printing' && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                              <Printer className="h-3 w-3" />
                              <span>In progress</span>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Queued</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Printing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Past Deadline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Rush</span>
        </div>
      </div>

      {/* Empty state */}
      {scheduledJobs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No jobs to schedule</p>
            <p className="text-sm text-gray-400 mt-1">
              Create orders to see them automatically scheduled here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
