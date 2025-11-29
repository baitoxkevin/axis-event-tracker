'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plane,
  Bus,
  Users,
  Clock,
  MapPin,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleCardProps {
  schedule: {
    id: string;
    direction: 'arrival' | 'departure';
    scheduleDate: string;
    pickupTime: string;
    pickupLocation?: string | null;
    dropoffLocation?: string | null;
    status?: string | null;
    notes?: string | null;
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
        email: string;
      };
    }>;
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onAssign?: () => void;
  onUnassign?: (assignmentId: string) => void;
}

export function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
}: ScheduleCardProps) {
  const [showAllGuests, setShowAllGuests] = useState(false);

  const assignedCount = schedule.assignments?.length || 0;
  const capacity = schedule.vehicle?.capacity || 0;
  const availableSpots = capacity - assignedCount;
  const isFull = availableSpots === 0;

  const displayedGuests = showAllGuests
    ? schedule.assignments
    : schedule.assignments?.slice(0, 5);
  const hasMoreGuests = (schedule.assignments?.length || 0) > 5;

  return (
    <Card className={cn(
      'transition-shadow hover:shadow-md',
      schedule.direction === 'arrival' && 'border-l-4 border-l-blue-500',
      schedule.direction === 'departure' && 'border-l-4 border-l-orange-500'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Plane
              className={cn(
                'h-5 w-5',
                schedule.direction === 'arrival' && 'text-blue-500',
                schedule.direction === 'departure' && 'rotate-90 text-orange-500'
              )}
            />
            <CardTitle className="text-base">
              {schedule.direction === 'arrival' ? 'Arrival' : 'Departure'}
            </CardTitle>
            <Badge
              variant={isFull ? 'secondary' : 'outline'}
              className={cn(
                isFull && 'bg-green-100 text-green-800'
              )}
            >
              {assignedCount}/{capacity}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Schedule
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Schedule
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Schedule info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{schedule.pickupTime}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bus className="h-4 w-4" />
            <span>{schedule.vehicle?.name || 'No vehicle'}</span>
          </div>
          {schedule.pickupLocation && (
            <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{schedule.pickupLocation}</span>
            </div>
          )}
        </div>

        {/* Flight notes */}
        {schedule.notes && (
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <Plane className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{schedule.notes}</span>
            </div>
          </div>
        )}

        {/* Assigned guests */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Assigned Guests</span>
            {!isFull && onAssign && (
              <Button variant="ghost" size="sm" onClick={onAssign}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
          </div>

          {assignedCount === 0 ? (
            <p className="text-sm text-muted-foreground">No guests assigned yet</p>
          ) : (
            <div className="space-y-1">
              {displayedGuests?.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                >
                  <span>
                    {assignment.guest.firstName} {assignment.guest.lastName}
                  </span>
                  {onUnassign && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onUnassign(assignment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}

              {hasMoreGuests && !showAllGuests && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAllGuests(true)}
                >
                  Show {(schedule.assignments?.length || 0) - 5} more
                </Button>
              )}

              {showAllGuests && hasMoreGuests && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAllGuests(false)}
                >
                  Show less
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Capacity indicator */}
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-all',
              isFull ? 'bg-green-500' : 'bg-primary'
            )}
            style={{ width: `${(assignedCount / capacity) * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
