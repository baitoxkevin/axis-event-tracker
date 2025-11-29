'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plane, Bus, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  direction: 'arrival' | 'departure';
  scheduleDate: string;
  pickupTime: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  vehicle?: {
    id: string;
    name: string;
    type: string;
    capacity: number;
  } | null;
  assignments?: Array<{
    id: string;
    guest: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

interface TimelineViewProps {
  schedules: Schedule[];
  onScheduleClick?: (schedule: Schedule) => void;
}

// Generate time slots from 5am to 11pm
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 5; hour <= 23; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
};

// Parse time string to minutes from midnight
const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Calculate position percentage based on time (5am = 0%, 11pm = 100%)
const getTimePosition = (time: string): number => {
  const minutes = parseTimeToMinutes(time);
  const startMinutes = 5 * 60; // 5am
  const endMinutes = 23 * 60; // 11pm
  const totalMinutes = endMinutes - startMinutes;

  const position = ((minutes - startMinutes) / totalMinutes) * 100;
  return Math.max(0, Math.min(100, position));
};

export function TimelineView({ schedules, onScheduleClick }: TimelineViewProps) {
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Group schedules by vehicle
  const schedulesByVehicle = useMemo(() => {
    const grouped = new Map<string, { vehicle: Schedule['vehicle']; schedules: Schedule[] }>();

    // Add "Unassigned" group for schedules without vehicles
    grouped.set('unassigned', { vehicle: null, schedules: [] });

    schedules.forEach((schedule) => {
      const vehicleId = schedule.vehicle?.id || 'unassigned';

      if (!grouped.has(vehicleId)) {
        grouped.set(vehicleId, {
          vehicle: schedule.vehicle,
          schedules: [],
        });
      }

      grouped.get(vehicleId)!.schedules.push(schedule);
    });

    // Sort schedules within each vehicle by time
    grouped.forEach((group) => {
      group.schedules.sort((a, b) =>
        parseTimeToMinutes(a.pickupTime) - parseTimeToMinutes(b.pickupTime)
      );
    });

    // Remove empty unassigned group
    if (grouped.get('unassigned')?.schedules.length === 0) {
      grouped.delete('unassigned');
    }

    return grouped;
  }, [schedules]);

  if (schedules.length === 0) {
    return (
      <Card className="py-12 text-center">
        <Bus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No schedules for this period</h3>
        <p className="text-muted-foreground">
          Create a schedule to see it on the timeline.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Schedule Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            {/* Time header */}
            <div className="mb-4 flex border-b pb-2">
              <div className="w-32 shrink-0 pr-4">
                <span className="text-sm font-medium text-muted-foreground">Vehicle</span>
              </div>
              <div className="relative flex-1">
                <div className="flex justify-between">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      className="text-xs text-muted-foreground"
                      style={{ width: `${100 / timeSlots.length}%` }}
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Vehicle rows */}
            <div className="space-y-3">
              {Array.from(schedulesByVehicle.entries()).map(([vehicleId, { vehicle, schedules: vehicleSchedules }]) => (
                <div key={vehicleId} className="flex items-center">
                  {/* Vehicle label */}
                  <div className="w-32 shrink-0 pr-4">
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-muted-foreground" />
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">
                          {vehicle?.name || 'Unassigned'}
                        </p>
                        {vehicle && (
                          <p className="text-xs text-muted-foreground">
                            {vehicle.capacity} seats
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline track */}
                  <div className="relative h-12 flex-1 rounded-lg bg-muted/30">
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeSlots.map((slot, idx) => (
                        <div
                          key={slot}
                          className={cn(
                            'h-full border-l border-dashed border-muted-foreground/20',
                            idx === 0 && 'border-l-0'
                          )}
                          style={{ width: `${100 / timeSlots.length}%` }}
                        />
                      ))}
                    </div>

                    {/* Schedule blocks */}
                    <TooltipProvider>
                      {vehicleSchedules.map((schedule) => {
                        const position = getTimePosition(schedule.pickupTime);
                        const assignedCount = schedule.assignments?.length || 0;
                        const capacity = schedule.vehicle?.capacity || 0;
                        const isFull = capacity > 0 && assignedCount >= capacity;

                        return (
                          <Tooltip key={schedule.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onScheduleClick?.(schedule)}
                                className={cn(
                                  'absolute top-1 h-10 min-w-[80px] rounded-md px-2 py-1 text-left transition-all hover:ring-2 hover:ring-ring',
                                  schedule.direction === 'arrival'
                                    ? 'bg-blue-500/20 border border-blue-500 text-blue-700 dark:text-blue-300'
                                    : 'bg-orange-500/20 border border-orange-500 text-orange-700 dark:text-orange-300'
                                )}
                                style={{
                                  left: `${position}%`,
                                  transform: 'translateX(-50%)',
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Plane
                                    className={cn(
                                      'h-3 w-3 shrink-0',
                                      schedule.direction === 'departure' && 'rotate-90'
                                    )}
                                  />
                                  <span className="text-xs font-medium">
                                    {schedule.pickupTime}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-xs opacity-80">
                                  <Users className="h-3 w-3" />
                                  <span>
                                    {assignedCount}
                                    {capacity > 0 && `/${capacity}`}
                                  </span>
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {schedule.direction === 'arrival' ? 'Arrival' : 'Departure'}
                                </p>
                                <p className="text-sm">
                                  <Clock className="mr-1 inline h-3 w-3" />
                                  Pickup at {schedule.pickupTime}
                                </p>
                                {schedule.pickupLocation && (
                                  <p className="text-sm text-muted-foreground">
                                    From: {schedule.pickupLocation}
                                  </p>
                                )}
                                {schedule.dropoffLocation && (
                                  <p className="text-sm text-muted-foreground">
                                    To: {schedule.dropoffLocation}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <Badge variant={isFull ? 'default' : 'outline'} className="text-xs">
                                    {assignedCount}/{capacity || '?'} guests
                                  </Badge>
                                </div>
                                {schedule.assignments && schedule.assignments.length > 0 && (
                                  <div className="border-t pt-1 mt-1">
                                    <p className="text-xs text-muted-foreground mb-1">Assigned:</p>
                                    <div className="text-xs space-y-0.5">
                                      {schedule.assignments.slice(0, 5).map((a) => (
                                        <p key={a.id}>
                                          {a.guest.firstName} {a.guest.lastName}
                                        </p>
                                      ))}
                                      {schedule.assignments.length > 5 && (
                                        <p className="text-muted-foreground">
                                          +{schedule.assignments.length - 5} more
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 border-t pt-4">
              <span className="text-sm text-muted-foreground">Legend:</span>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-blue-500 bg-blue-500/20" />
                <span className="text-sm">Arrival</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-orange-500 bg-orange-500/20" />
                <span className="text-sm">Departure</span>
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
