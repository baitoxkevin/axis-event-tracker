'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  Bus,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  UserMinus,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwipeableGuestCard } from './swipeable-guest-card';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  guestId: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    arrivalFlightNumber?: string | null;
    departureFlightNumber?: string | null;
    arrivalTime?: string | null;
    departureTime?: string | null;
    arrivalFlightStatus?: string | null;
    departureFlightStatus?: string | null;
    arrivalTimeMismatch?: boolean;
    departureTimeMismatch?: boolean;
    travelType?: string | null;
  } | null;
  assignmentType: 'arrival' | 'departure';
}

interface ScheduleCardEnhancedProps {
  schedule: {
    id: string;
    vehicleId: string;
    direction: 'arrival' | 'departure';
    scheduleDate: string;
    pickupTime: string;
    pickupLocation?: string | null;
    dropoffLocation?: string | null;
    status: string;
    vehicle?: {
      id: string;
      name: string;
      capacity: number;
      vehicleType?: string;
    } | null;
    assignments?: Assignment[];
  };
  onUnassign?: (assignmentId: string) => void;
  onRefresh?: () => void;
  showBulkActions?: boolean;
}

export function ScheduleCardEnhanced({
  schedule,
  onUnassign,
  onRefresh,
  showBulkActions = true,
}: ScheduleCardEnhancedProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const unassignMutation = trpc.transport.assignments.unassign.useMutation({
    onSuccess: () => {
      toast.success('Guest unassigned');
      utils.transport.schedules.list.invalidate();
      utils.transport.dashboard.stats.invalidate();
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const capacity = schedule.vehicle?.capacity || 0;
  const assigned = schedule.assignments?.length || 0;
  const capacityPercent = capacity > 0 ? (assigned / capacity) * 100 : 0;

  // Check for delayed guests
  const delayedGuests = schedule.assignments?.filter((a) => {
    if (!a.guest) return false;
    if (schedule.direction === 'arrival') {
      return a.guest.arrivalTimeMismatch || a.guest.arrivalFlightStatus === 'cancelled';
    }
    return a.guest.departureTimeMismatch || a.guest.departureFlightStatus === 'cancelled';
  }) || [];

  const handleUnassign = (assignmentId: string) => {
    if (onUnassign) {
      onUnassign(assignmentId);
    } else {
      unassignMutation.mutate({ id: assignmentId });
    }
  };

  const handleBulkUnassign = () => {
    selectedAssignments.forEach((id) => {
      unassignMutation.mutate({ id });
    });
    setSelectedAssignments(new Set());
  };

  const toggleAssignment = (id: string, selected: boolean) => {
    const newSet = new Set(selectedAssignments);
    if (selected) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedAssignments(newSet);
  };

  return (
    <Card className={cn(
      'transition-all',
      delayedGuests.length > 0 && 'border-amber-300 bg-amber-50/30'
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bus className="h-4 w-4" />
              {schedule.vehicle?.name || 'Unknown Vehicle'}
              {delayedGuests.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {delayedGuests.length} delayed
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{delayedGuests.length} guest(s) have flight delays/cancellations</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Schedule info row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {schedule.pickupTime}
            </span>
            {schedule.pickupLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {schedule.pickupLocation}
              </span>
            )}
            <Badge
              variant={schedule.direction === 'arrival' ? 'default' : 'secondary'}
            >
              {schedule.direction === 'arrival' ? 'Pickup' : 'Send-off'}
            </Badge>
          </div>

          {/* Capacity bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {assigned} / {capacity}
              </span>
              <span className={cn(
                'text-xs font-medium',
                capacityPercent >= 90 ? 'text-red-600' :
                capacityPercent >= 70 ? 'text-amber-600' : 'text-green-600'
              )}>
                {capacity - assigned} spots left
              </span>
            </div>
            <Progress
              value={capacityPercent}
              className={cn(
                'h-2',
                capacityPercent >= 90 ? '[&>div]:bg-red-500' :
                capacityPercent >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'
              )}
            />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2">
            {/* Bulk actions */}
            {showBulkActions && selectedAssignments.size > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-md bg-muted p-2">
                <span className="text-sm font-medium">
                  {selectedAssignments.size} selected
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkUnassign}
                  disabled={unassignMutation.isPending}
                >
                  <UserMinus className="mr-1 h-4 w-4" />
                  Unassign Selected
                </Button>
              </div>
            )}

            {/* Assigned guests */}
            <div className="space-y-2">
              {schedule.assignments && schedule.assignments.length > 0 ? (
                schedule.assignments.map((assignment) => {
                  const guest = assignment.guest;
                  if (!guest) return null;

                  const isDelayed = schedule.direction === 'arrival'
                    ? guest.arrivalTimeMismatch || guest.arrivalFlightStatus === 'cancelled'
                    : guest.departureTimeMismatch || guest.departureFlightStatus === 'cancelled';

                  return (
                    <SwipeableGuestCard
                      key={assignment.id}
                      guest={{
                        id: guest.id,
                        name: `${guest.firstName} ${guest.lastName}`,
                        flightNumber: schedule.direction === 'arrival'
                          ? guest.arrivalFlightNumber
                          : guest.departureFlightNumber,
                        time: schedule.direction === 'arrival'
                          ? guest.arrivalTime
                          : guest.departureTime,
                        status: schedule.direction === 'arrival'
                          ? guest.arrivalFlightStatus
                          : guest.departureFlightStatus,
                        travelType: guest.travelType,
                      }}
                      isSelected={selectedAssignments.has(assignment.id)}
                      onSelect={(selected) => toggleAssignment(assignment.id, selected)}
                      onSwipeLeft={() => handleUnassign(assignment.id)}
                      swipeLeftLabel="Unassign"
                      showCheckbox={showBulkActions}
                    />
                  );
                })
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No guests assigned yet
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
