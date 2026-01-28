'use client';

import { PrintJob } from '@/types/database';
import { Clock } from 'lucide-react';

interface ProductionTimelineProps {
  jobs: PrintJob[];
}

// Progress bar component - white background with black outline, tan fill
function MultiSegmentProgress({ completed, total }: { completed: number; total: number }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="h-2.5 w-full rounded-full bg-white border border-gray-900 overflow-hidden">
      {/* Completed fill - tan color */}
      {percentage > 0 && (
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: '#999184' }}
        />
      )}
    </div>
  );
}

export function ProductionTimeline({ jobs }: ProductionTimelineProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Production Queue</h2>
        <div className="text-center py-8 text-gray-400">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No active print jobs</p>
          <p className="text-sm mt-1">Create an order to start production</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Production Queue</h2>
      <div className="divide-y divide-gray-100">
        {jobs.map((job, index) => {
          const progress = job.quantity_needed > 0
            ? Math.round((job.quantity_completed / job.quantity_needed) * 100)
            : 0;

          return (
            <div key={job.id} className={index === 0 ? 'pb-5' : 'py-5'}>
              {/* Part name and percentage */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">
                  {job.part?.name || 'Unknown Part'}
                </span>
                <span className="text-base font-semibold text-gray-700">
                  {progress}%
                </span>
              </div>

              {/* Prints completed count */}
              <p className="text-sm text-gray-400 mb-2">
                {job.quantity_completed}/{job.quantity_needed} prints completed
              </p>

              {/* Multi-segment progress bar */}
              <MultiSegmentProgress
                completed={job.quantity_completed}
                total={job.quantity_needed}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
