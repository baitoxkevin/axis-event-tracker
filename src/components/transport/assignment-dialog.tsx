'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Users, Plane } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: {
    id: string;
    direction: 'arrival' | 'departure';
    scheduleDate: string;
    pickupTime: string;
    vehicle?: {
      name: string;
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
  };
  onAssign: (guestIds: string[]) => void;
  isAssigning?: boolean;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  schedule,
  onAssign,
  isAssigning = false,
}: AssignmentDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);

  // Fetch unassigned guests for this direction and date
  const { data: unassignedGuests, isLoading } =
    trpc.transport.dashboard.unassignedGuests.useQuery(
      {
        direction: schedule.direction,
        date: schedule.scheduleDate,
      },
      { enabled: open }
    );

  // Calculate capacity
  const currentAssigned = schedule.assignments?.length || 0;
  const capacity = schedule.vehicle?.capacity || 0;
  const availableSpots = capacity - currentAssigned;

  // Filter guests by search
  const filteredGuests = useMemo(() => {
    if (!unassignedGuests) return [];
    if (!search) return unassignedGuests;

    const searchLower = search.toLowerCase();
    return unassignedGuests.filter(
      (guest) =>
        guest.firstName.toLowerCase().includes(searchLower) ||
        guest.lastName.toLowerCase().includes(searchLower) ||
        guest.email.toLowerCase().includes(searchLower)
    );
  }, [unassignedGuests, search]);

  // Toggle guest selection
  const toggleGuest = (guestId: string) => {
    setSelectedGuests((prev) => {
      if (prev.includes(guestId)) {
        return prev.filter((id) => id !== guestId);
      }
      // Check capacity
      if (prev.length >= availableSpots) {
        return prev; // Don't allow more
      }
      return [...prev, guestId];
    });
  };

  // Select all visible guests (up to capacity)
  const selectAll = () => {
    const toSelect = filteredGuests
      .slice(0, availableSpots)
      .map((g) => g.id);
    setSelectedGuests(toSelect);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedGuests([]);
  };

  // Handle assign
  const handleAssign = () => {
    if (selectedGuests.length > 0) {
      onAssign(selectedGuests);
      setSelectedGuests([]);
    }
  };

  // Reset on close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedGuests([]);
      setSearch('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign Guests to Transport</DialogTitle>
        </DialogHeader>

        {/* Schedule info */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {schedule.direction === 'arrival' ? 'Arrival' : 'Departure'} -{' '}
                {format(new Date(schedule.scheduleDate), 'MMM d, yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                Pickup at {schedule.pickupTime}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">{schedule.vehicle?.name || 'No vehicle'}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {currentAssigned}/{capacity} seats filled
                </span>
              </div>
            </div>
          </div>
          {availableSpots > 0 && (
            <Badge className="mt-2" variant="outline">
              {availableSpots} spot{availableSpots !== 1 ? 's' : ''} available
            </Badge>
          )}
          {availableSpots === 0 && (
            <Badge className="mt-2" variant="destructive">
              Vehicle is full
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selection controls */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedGuests.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={availableSpots === 0}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selectedGuests.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Guest list */}
        <ScrollArea className="h-[300px] rounded-lg border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Users className="mb-2 h-8 w-8" />
              <p>No unassigned guests found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredGuests.map((guest) => {
                const isSelected = selectedGuests.includes(guest.id);
                const isDisabled = !isSelected && selectedGuests.length >= availableSpots;

                return (
                  <div
                    key={guest.id}
                    className={`flex items-center gap-3 p-3 ${
                      isDisabled ? 'opacity-50' : 'cursor-pointer hover:bg-accent'
                    }`}
                    onClick={() => !isDisabled && toggleGuest(guest.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      onCheckedChange={() => toggleGuest(guest.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{guest.email}</p>
                    </div>
                    {schedule.direction === 'arrival' && guest.arrivalFlightNumber && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Plane className="h-4 w-4" />
                        <span>{guest.arrivalFlightNumber}</span>
                        {guest.arrivalTime && (
                          <span>@ {guest.arrivalTime}</span>
                        )}
                      </div>
                    )}
                    {schedule.direction === 'departure' && guest.departureFlightNumber && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Plane className="h-4 w-4" />
                        <span>{guest.departureFlightNumber}</span>
                        {guest.departureTime && (
                          <span>@ {guest.departureTime}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedGuests.length === 0 || isAssigning}
          >
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign {selectedGuests.length} Guest{selectedGuests.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
