'use client';

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';
import {
  Search,
  User,
  Plane,
  Clock,
  UserPlus,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  direction: 'arrival' | 'departure';
  scheduleDate: string;
  onSelect: (guestId: string) => void;
  isLoading?: boolean;
  excludeGuestIds?: string[];
}

export function GuestSelector({
  open,
  onOpenChange,
  scheduleId,
  direction,
  scheduleDate,
  onSelect,
  isLoading,
  excludeGuestIds = [],
}: GuestSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch unassigned guests for the date and direction
  const { data: unassignedGuests, isLoading: isLoadingGuests } =
    trpc.transport.dashboard.unassignedGuests.useQuery(
      { direction, date: scheduleDate },
      { enabled: open }
    );

  // Filter guests based on search and exclusion list
  const filteredGuests = useMemo(() => {
    if (!unassignedGuests) return [];

    return unassignedGuests.filter((guest) => {
      // Exclude already assigned guests
      if (excludeGuestIds.includes(guest.id)) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        const email = (guest.email || '').toLowerCase();
        const flightNumber =
          (direction === 'arrival'
            ? guest.arrivalFlightNumber
            : guest.departureFlightNumber
          )?.toLowerCase() || '';

        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          flightNumber.includes(searchLower)
        );
      }

      return true;
    });
  }, [unassignedGuests, excludeGuestIds, search, direction]);

  const handleSelect = (guestId: string) => {
    setSelectedId(guestId);
    onSelect(guestId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="text-left">Add Passenger</SheetTitle>
          <SheetDescription className="text-left">
            Select a guest to add to this {direction} transport
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or flight..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="flex-1 h-[calc(80vh-160px)]">
          <div className="px-4 space-y-2">
            {isLoadingGuests ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredGuests.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {search
                    ? 'No guests match your search'
                    : 'No unassigned guests for this date'}
                </p>
                {search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setSearch('')}
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              filteredGuests.map((guest) => {
                const flightNumber =
                  direction === 'arrival'
                    ? guest.arrivalFlightNumber
                    : guest.departureFlightNumber;
                const flightTime =
                  direction === 'arrival' ? guest.arrivalTime : guest.departureTime;
                const isSelecting = isLoading && selectedId === guest.id;

                return (
                  <button
                    key={guest.id}
                    onClick={() => handleSelect(guest.id)}
                    disabled={isLoading}
                    className={cn(
                      'w-full p-3 rounded-lg border bg-card text-left transition-all',
                      'hover:border-primary hover:bg-primary/5',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelecting && 'border-primary bg-primary/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {guest.firstName} {guest.lastName}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {flightNumber && (
                            <span className="flex items-center gap-1">
                              <Plane className="h-3 w-3" />
                              {flightNumber}
                            </span>
                          )}
                          {flightTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {flightTime?.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isSelecting ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <UserPlus className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Travel type badge */}
                    {guest.travelType && (
                      <div className="mt-2 flex gap-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {guest.travelType}
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Stats Footer */}
        {!isLoadingGuests && filteredGuests.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/30 text-center text-sm text-muted-foreground">
            {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}{' '}
            available
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
