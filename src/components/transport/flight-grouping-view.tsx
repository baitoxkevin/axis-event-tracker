'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Clock, Plane, Users, Bus, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwipeableGuestCard } from './swipeable-guest-card';

interface FlightGroupingViewProps {
  date: string;
  direction: 'arrival' | 'departure';
  onAssignmentComplete?: () => void;
}

export function FlightGroupingView({
  date,
  direction,
  onAssignmentComplete,
}: FlightGroupingViewProps) {
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  const utils = trpc.useUtils();

  const { data: groupings, isLoading } =
    trpc.transport.dashboard.flightGroupings.useQuery({
      date,
      direction,
      timeWindowMinutes: 60, // 1-hour windows
    });

  const { data: schedules } = trpc.transport.schedules.list.useQuery({
    dateFrom: date,
    dateTo: date,
    direction,
  });

  const bulkAssign = trpc.transport.assignments.bulkAssign.useMutation({
    onSuccess: () => {
      toast.success(`${selectedGuests.size} guests assigned successfully`);
      setSelectedGuests(new Set());
      setAssignDialogOpen(false);
      setSelectedScheduleId('');
      utils.transport.dashboard.flightGroupings.invalidate();
      utils.transport.schedules.list.invalidate();
      onAssignmentComplete?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleGuest = (guestId: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(guestId)) {
      newSet.delete(guestId);
    } else {
      newSet.add(guestId);
    }
    setSelectedGuests(newSet);
  };

  const toggleGroup = (guestIds: string[]) => {
    const allSelected = guestIds.every((id) => selectedGuests.has(id));
    const newSet = new Set(selectedGuests);

    if (allSelected) {
      guestIds.forEach((id) => newSet.delete(id));
    } else {
      guestIds.forEach((id) => newSet.add(id));
    }
    setSelectedGuests(newSet);
  };

  const handleBulkAssign = () => {
    if (!selectedScheduleId || selectedGuests.size === 0) return;

    bulkAssign.mutate({
      scheduleId: selectedScheduleId,
      guestIds: Array.from(selectedGuests),
      assignmentType: direction,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Loading flight groupings...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!groupings || groupings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            All guests assigned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No unassigned guests for {direction}s on this date.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalUnassigned = groupings.reduce((acc, g) => acc + g.guestCount, 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Unassigned {direction === 'arrival' ? 'Arrivals' : 'Departures'}
              <Badge variant="secondary">{totalUnassigned} guests</Badge>
            </CardTitle>
            {selectedGuests.size > 0 && (
              <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
                <Bus className="mr-2 h-4 w-4" />
                Assign {selectedGuests.size} Selected
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {groupings.map((group) => {
                const groupGuestIds = group.guests.map((g) => g.id);
                const allSelected = groupGuestIds.every((id) =>
                  selectedGuests.has(id)
                );
                const someSelected = groupGuestIds.some((id) =>
                  selectedGuests.has(id)
                );

                return (
                  <div
                    key={group.timeWindow}
                    className="rounded-md border bg-slate-50/50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleGroup(groupGuestIds)}
                          className={cn(
                            someSelected && !allSelected && 'opacity-50'
                          )}
                        />
                        <Badge variant="outline" className="font-mono">
                          <Clock className="mr-1 h-3 w-3" />
                          {group.timeWindow}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {group.guestCount} guest(s)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          toggleGroup(groupGuestIds);
                          if (!allSelected) {
                            setAssignDialogOpen(true);
                          }
                        }}
                      >
                        Quick Assign
                      </Button>
                    </div>

                    <div className="ml-6 space-y-2">
                      {group.guests.map((guest) => (
                        <SwipeableGuestCard
                          key={guest.id}
                          guest={{
                            id: guest.id,
                            name: guest.name,
                            flightNumber: guest.flightNumber,
                            time: guest.time,
                            status: guest.status,
                            travelType: guest.travelType,
                          }}
                          isSelected={selectedGuests.has(guest.id)}
                          onSelect={(selected) => {
                            const newSet = new Set(selectedGuests);
                            if (selected) {
                              newSet.add(guest.id);
                            } else {
                              newSet.delete(guest.id);
                            }
                            setSelectedGuests(newSet);
                          }}
                          onSwipeRight={() => {
                            // Quick assign single guest - select and open dialog
                            setSelectedGuests(new Set([guest.id]));
                            setAssignDialogOpen(true);
                          }}
                          swipeRightLabel="Quick Assign"
                          swipeLeftLabel="Skip"
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Guests to Vehicle</DialogTitle>
            <DialogDescription>
              Select a vehicle schedule to assign {selectedGuests.size} guest(s).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select
              value={selectedScheduleId}
              onValueChange={setSelectedScheduleId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle schedule" />
              </SelectTrigger>
              <SelectContent>
                {schedules
                  ?.filter((s) => {
                    const capacity = s.vehicle?.capacity || 0;
                    const used = s.assignments?.length || 0;
                    const available = capacity - used;
                    return available >= selectedGuests.size;
                  })
                  .map((schedule) => {
                    const capacity = schedule.vehicle?.capacity || 0;
                    const used = schedule.assignments?.length || 0;
                    const available = capacity - used;

                    return (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        <div className="flex items-center gap-2">
                          <span>{schedule.vehicle?.name}</span>
                          <span className="text-muted-foreground">
                            @ {schedule.pickupTime}
                          </span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {available} spots available
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                {schedules?.filter((s) => {
                  const capacity = s.vehicle?.capacity || 0;
                  const used = s.assignments?.length || 0;
                  return capacity - used >= selectedGuests.size;
                }).length === 0 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No schedules with enough capacity.
                    <br />
                    Create a new schedule first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!selectedScheduleId || bulkAssign.isPending}
            >
              {bulkAssign.isPending
                ? 'Assigning...'
                : `Assign ${selectedGuests.size} Guest(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
