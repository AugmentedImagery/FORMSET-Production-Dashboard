'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PrintJob } from '@/types/database';
import { Clock, AlertTriangle } from 'lucide-react';

interface ProductionTimelineProps {
  jobs: PrintJob[];
}

export function ProductionTimeline({ jobs }: ProductionTimelineProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'printing':
        return 'bg-blue-100 text-blue-700';
      case 'queued':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'rush':
        return 'bg-orange-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Production Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No active print jobs</p>
            <p className="text-sm">Create an order to start production</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Production Queue</CardTitle>
        <Badge variant="secondary">{jobs.length} jobs</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job) => {
          const progress = job.quantity_needed > 0
            ? Math.round((job.quantity_completed / job.quantity_needed) * 100)
            : 0;
          const priority = job.production_order?.priority || 'normal';

          return (
            <div
              key={job.id}
              className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {/* Priority indicator */}
              <div className={`w-1 h-12 rounded-full ${getPriorityColor(priority)}`} />

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {job.part?.name || 'Unknown Part'}
                  </span>
                  <Badge className={getStatusColor(job.status)} variant="secondary">
                    {job.status}
                  </Badge>
                  {priority === 'rush' && (
                    <Badge className="bg-orange-100 text-orange-700" variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Rush
                    </Badge>
                  )}
                  {priority === 'critical' && (
                    <Badge className="bg-red-100 text-red-700" variant="secondary">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm text-gray-500">
                    {job.quantity_completed} / {job.quantity_needed} prints
                  </span>
                  {job.printer?.name && (
                    <span className="text-sm text-gray-500">
                      on {job.printer.name}
                    </span>
                  )}
                </div>
                <Progress value={progress} className="mt-2 h-1.5" />
              </div>

              {/* Progress percentage */}
              <div className="text-right">
                <span className="text-lg font-semibold text-gray-900">{progress}%</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
