'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  className,
}: StatsCardProps) {
  return (
    <div className={cn('bg-white rounded-xl p-6 border border-gray-100', className)}>
      <p className="text-sm font-semibold text-gray-900 mb-3">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {description && (
        <p className="text-sm text-gray-400">{description}</p>
      )}
    </div>
  );
}
