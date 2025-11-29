'use client';

import { cn } from '@/lib/utils';
import { Plane, AlertTriangle, CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';

type FlightStatus = 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown';

interface FlightStatusBadgeProps {
  status: FlightStatus | null | undefined;
  className?: string;
}

const statusConfig: Record<FlightStatus, { label: string; className: string; icon: typeof Plane }> = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  active: {
    label: 'In Flight',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: Plane,
  },
  landed: {
    label: 'Landed',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
  diverted: {
    label: 'Diverted',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertTriangle,
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: HelpCircle,
  },
};

export function FlightStatusBadge({ status, className }: FlightStatusBadgeProps) {
  const config = statusConfig[status || 'unknown'];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
