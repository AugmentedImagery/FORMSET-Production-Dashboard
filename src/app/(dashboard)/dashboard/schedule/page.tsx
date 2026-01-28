'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfDay,
  isToday as checkIsToday,
} from 'date-fns';
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
  AlertCircle,
  Package,
  ArrowRight,
} from 'lucide-react';
import { ScheduledJob, getAvailablePrinters, formatPrintTime } from '@/lib/scheduling';

export default function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { scheduledJobs, printers, isLoading, error } = useScheduleData();
  const { canEdit } = useAuth();

  // Get available printers count
  const availablePrinters = useMemo(() =>
    getAvailablePrinters(printers || []),
    [printers]
  );

  // Generate calendar days for the month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

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

  // Today's jobs
  const todayJobs = getJobsForDay(new Date());
  const todayCapacity = getDayCapacity(new Date());

  // Selected day's jobs
  const selectedDayJobs = getJobsForDay(selectedDate);
  const selectedDayCapacity = getDayCapacity(selectedDate);

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

  const getStatusBadge = (status: string, isPastDeadline: boolean) => {
    if (isPastDeadline) {
      return <Badge className="bg-red-100 text-red-700">Past Deadline</Badge>;
    }
    switch (status) {
      case 'printing':
        return <Badge className="bg-blue-100 text-blue-700">Printing</Badge>;
      case 'queued':
        return <Badge className="bg-yellow-100 text-yellow-700">Queued</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  const getPriorityBadge = (priority: string) => {
    if (priority === 'critical') {
      return <Badge className="bg-red-500 text-white">Critical</Badge>;
    }
    if (priority === 'rush') {
      return <Badge className="bg-orange-500 text-white">Rush</Badge>;
    }
    return <Badge variant="outline">Normal</Badge>;
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
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

  const isSelectedToday = checkIsToday(selectedDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
          <p className="text-gray-500">Auto-scheduled based on printer capacity</p>
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

      {/* Main content: Today's detail + Month calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Detailed View */}
        <Card className="lg:col-span-1 lg:row-span-2">
          <CardHeader className={`${isSelectedToday ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isSelectedToday ? 'text-blue-600' : 'text-gray-500'}`}>
                  {isSelectedToday ? "Today's Schedule" : format(selectedDate, 'EEEE')}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </p>
              </div>
              {isSelectedToday && (
                <div className="h-12 w-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold">
                  {format(new Date(), 'd')}
                </div>
              )}
            </div>
            {!isWeekend(selectedDate) && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Capacity</span>
                  <span className="font-medium">{selectedDayCapacity.percentage}% booked</span>
                </div>
                <Progress value={selectedDayCapacity.percentage} className="h-2" />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 max-h-[500px] overflow-y-auto">
            {isWeekend(selectedDate) ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Weekend - No production scheduled</p>
              </div>
            ) : selectedDayJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No jobs scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayJobs.map((job) => {
                  const progress = job.quantity_needed > 0
                    ? Math.round((job.quantity_completed / job.quantity_needed) * 100)
                    : 0;
                  const remaining = job.quantity_needed - job.quantity_completed;

                  // Calculate print cycles
                  const partsPerPrint = job.part?.parts_per_print || 1;
                  const printTimePerCycle = job.part?.print_time_minutes || 60;
                  const totalPrintsNeeded = Math.ceil(job.quantity_needed / partsPerPrint);
                  const printsCompleted = Math.floor(job.quantity_completed / partsPerPrint);
                  const printsRemaining = Math.ceil(remaining / partsPerPrint);

                  // Calculate prints for THIS specific day
                  // Based on available working hours (8h = 480min per day) × number of printers
                  const workingMinutesPerDay = 8 * 60;
                  const printsPerPrinterPerDay = Math.floor(workingMinutesPerDay / printTimePerCycle);
                  const numPrinters = Math.max(availablePrinters.length, 1);
                  const totalPrintsPerDay = printsPerPrinterPerDay * numPrinters;

                  // Calculate which day of the job this is
                  const jobStartDay = startOfDay(job.scheduledDate);
                  const selectedDay = startOfDay(selectedDate);
                  const daysSinceJobStart = Math.floor((selectedDay.getTime() - jobStartDay.getTime()) / (1000 * 60 * 60 * 24));

                  // Calculate prints already done in previous days of this job
                  const printsDoneInPreviousDays = Math.min(daysSinceJobStart * totalPrintsPerDay, printsRemaining);
                  const printsRemainingAfterPreviousDays = Math.max(0, printsRemaining - printsDoneInPreviousDays);

                  // Prints scheduled for this specific day (across all printers)
                  const printsForThisDay = Math.min(totalPrintsPerDay, printsRemainingAfterPreviousDays);
                  const printTimeForThisDay = Math.ceil(printsForThisDay / numPrinters) * printTimePerCycle;

                  return (
                    <Link
                      key={job.id}
                      href={`/dashboard/orders/${job.production_order_id}`}
                      className={`block p-4 rounded-lg border-l-4 ${getStatusColor(job.status, job.isPastDeadline)} hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPriorityIndicator(job.production_order?.priority || 'normal')}
                          <span className="font-semibold text-gray-900">
                            {job.part?.name}
                          </span>
                        </div>
                        {getStatusBadge(job.status, job.isPastDeadline)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Order</span>
                          <span className="font-medium">
                            {job.production_order?.shopify_order_number || job.production_order?.id.slice(0, 8) || 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600">
                          <span>Product</span>
                          <span className="font-medium">
                            {job.production_order?.product?.name || 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600">
                          <span>Priority</span>
                          {getPriorityBadge(job.production_order?.priority || 'normal')}
                        </div>

                        {/* Parts progress */}
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Parts Progress</span>
                          <span className="font-medium">
                            {job.quantity_completed} / {job.quantity_needed} parts
                          </span>
                        </div>

                        <Progress value={progress} className="h-2" />

                        {/* Print cycles for THIS DAY */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 space-y-1">
                          <div className="flex items-center justify-between text-blue-800">
                            <span className="flex items-center gap-1 font-medium">
                              <Printer className="h-3.5 w-3.5" />
                              Prints for This Day
                            </span>
                            <span className="font-bold text-blue-900 text-lg">
                              {printsForThisDay}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-blue-600">
                            <span>~{formatPrintTime(printTimeForThisDay)} of printing</span>
                            <span>{partsPerPrint * printsForThisDay} parts</span>
                          </div>
                        </div>

                        {/* Total job progress */}
                        <div className="bg-gray-100 rounded-lg p-2 space-y-1">
                          <div className="flex items-center justify-between text-gray-700">
                            <span className="text-xs">Total Job Progress</span>
                            <span className="font-medium text-gray-900">
                              {printsCompleted} / {totalPrintsNeeded} prints
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{partsPerPrint} part{partsPerPrint !== 1 ? 's' : ''} per print</span>
                            <span className="font-medium">
                              {printsRemaining} print{printsRemaining !== 1 ? 's' : ''} remaining total
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Total Time Remaining
                          </span>
                          <span className="font-medium">
                            {formatPrintTime(printsRemaining * printTimePerCycle)}
                          </span>
                        </div>

                        {job.production_order?.due_date && (
                          <div className="flex items-center justify-between text-gray-600">
                            <span>Due Date</span>
                            <span className={`font-medium ${job.isPastDeadline ? 'text-red-600' : ''}`}>
                              {format(new Date(job.production_order.due_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}

                        {job.printer && (
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="flex items-center gap-1">
                              <Printer className="h-3.5 w-3.5" />
                              Printer
                            </span>
                            <span className="font-medium">{job.printer.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t flex items-center justify-end text-blue-600 text-sm">
                        <span>View Order</span>
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayJobs = getJobsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = checkIsToday(day);
                const isSelected = isSameDay(day, selectedDate);
                const isWeekendDay = isWeekend(day);
                const capacity = getDayCapacity(day);
                const hasPastDeadline = dayJobs.some(j => j.isPastDeadline);
                const hasPrinting = dayJobs.some(j => j.status === 'printing');

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative p-2 min-h-[80px] rounded-lg border text-left transition-all
                      ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'}
                      ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-gray-50' : 'bg-white'}
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                      ${isWeekendDay ? 'opacity-60' : ''}
                      hover:border-blue-300 hover:shadow-sm
                    `}
                  >
                    <div className={`
                      text-sm font-medium mb-1
                      ${isToday ? 'text-blue-600' : 'text-gray-900'}
                    `}>
                      {format(day, 'd')}
                    </div>

                    {!isWeekendDay && isCurrentMonth && (
                      <>
                        {/* Capacity bar */}
                        {dayJobs.length > 0 && (
                          <div className="mb-1">
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  capacity.percentage > 90
                                    ? 'bg-red-500'
                                    : capacity.percentage > 70
                                    ? 'bg-orange-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${capacity.percentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Job indicators */}
                        <div className="flex flex-wrap gap-0.5">
                          {dayJobs.slice(0, 4).map((job) => (
                            <div
                              key={job.id}
                              className={`
                                w-2 h-2 rounded-full
                                ${job.isPastDeadline
                                  ? 'bg-red-500'
                                  : job.status === 'printing'
                                  ? 'bg-blue-500'
                                  : 'bg-yellow-500'
                                }
                              `}
                              title={job.part?.name}
                            />
                          ))}
                          {dayJobs.length > 4 && (
                            <span className="text-xs text-gray-400">
                              +{dayJobs.length - 4}
                            </span>
                          )}
                        </div>

                        {/* Status indicators */}
                        {dayJobs.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Alert indicator */}
                        {hasPastDeadline && (
                          <div className="absolute top-1 right-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          </div>
                        )}
                      </>
                    )}

                    {isWeekendDay && isCurrentMonth && (
                      <div className="text-xs text-gray-400 mt-1">Off</div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Queued</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Printing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Past Deadline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Critical Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Rush Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-6 bg-green-500 rounded-full" />
          <span>&lt;70% capacity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-6 bg-orange-500 rounded-full" />
          <span>70-90% capacity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-6 bg-red-500 rounded-full" />
          <span>&gt;90% capacity</span>
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
