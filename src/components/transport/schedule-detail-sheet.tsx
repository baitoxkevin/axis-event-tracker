'use client';

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc/client';
import {
  Bus,
  Users,
  Clock,
  MapPin,
  Plane,
  UserPlus,
  UserMinus,
  Phone,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GuestSelector } from './guest-selector';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleDetailSheetProps {
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
      vehicleType?: string;
      type?: string;
      capacity: number;
      driverName?: string | null;
      driverPhone?: string | null;
    } | null;
    assignments?: Array<{
      id: string;
      guest: {
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string | null;
        arrivalFlightNumber?: string | null;
        departureFlightNumber?: string | null;
      };
    }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function ScheduleDetailSheet({
  schedule: initialSchedule,
  open,
  onOpenChange,
  onUpdate,
}: ScheduleDetailSheetProps) {
  const [showGuestSelector, setShowGuestSelector] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [assigningGuestId, setAssigningGuestId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch unassigned guests for Quick Assign feature
  const { data: unassignedArrivals } = trpc.transport.dashboard.unassignedGuests.useQuery(
    { direction: 'arrival' },
    { enabled: open && initialSchedule?.direction === 'arrival' }
  );
  const { data: unassignedDepartures } = trpc.transport.dashboard.unassignedGuests.useQuery(
    { direction: 'departure' },
    { enabled: open && initialSchedule?.direction === 'departure' }
  );

  // Fetch fresh schedule data when sheet is open
  const { data: freshScheduleData, refetch: refetchSchedule } = trpc.transport.schedules.getById.useQuery(
    { id: initialSchedule?.id || '' },
    {
      enabled: open && !!initialSchedule?.id,
      refetchOnMount: true,
    }
  );

  // Use fresh data if available, otherwise fall back to initial
  const schedule = freshScheduleData ? {
    ...initialSchedule,
    ...freshScheduleData,
    vehicle: freshScheduleData.vehicle ? {
      ...freshScheduleData.vehicle,
      vehicleType: freshScheduleData.vehicle.vehicle_type || freshScheduleData.vehicle.vehicleType,
      driverName: freshScheduleData.vehicle.driver_name || freshScheduleData.vehicle.driverName,
      driverPhone: freshScheduleData.vehicle.driver_phone || freshScheduleData.vehicle.driverPhone,
    } : initialSchedule?.vehicle,
    assignments: freshScheduleData.assignments?.map((a: Record<string, unknown>) => ({
      id: a.id as string,
      guest: a.guest ? {
        id: (a.guest as Record<string, unknown>).id as string,
        firstName: (a.guest as Record<string, unknown>).first_name as string || (a.guest as Record<string, unknown>).firstName as string,
        lastName: (a.guest as Record<string, unknown>).last_name as string || (a.guest as Record<string, unknown>).lastName as string,
        email: (a.guest as Record<string, unknown>).email as string,
        phone: (a.guest as Record<string, unknown>).phone as string | null,
        arrivalFlightNumber: (a.guest as Record<string, unknown>).arrival_flight_number as string | null || (a.guest as Record<string, unknown>).arrivalFlightNumber as string | null,
        departureFlightNumber: (a.guest as Record<string, unknown>).departure_flight_number as string | null || (a.guest as Record<string, unknown>).departureFlightNumber as string | null,
      } : null,
    })).filter((a: { guest: unknown }) => a.guest) || initialSchedule?.assignments,
  } : initialSchedule;

  const unassignMutation = trpc.transport.assignments.unassign.useMutation({
    onSuccess: () => {
      toast.success('Guest removed from schedule');
      refetchSchedule();
      utils.transport.schedules.list.invalidate();
      utils.transport.dashboard.unassignedGuests.invalidate();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove guest');
    },
    onSettled: () => {
      setRemovingId(null);
    },
  });

  const assignMutation = trpc.transport.assignments.assign.useMutation({
    onSuccess: () => {
      toast.success('Guest added to schedule');
      refetchSchedule();
      utils.transport.schedules.list.invalidate();
      utils.transport.dashboard.unassignedGuests.invalidate();
      setShowGuestSelector(false);
      setAssigningGuestId(null);
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add guest');
      setAssigningGuestId(null);
    },
  });

  // Get suggested guests for quick assign (matching flight times)
  const suggestedGuests = useMemo(() => {
    if (!initialSchedule) return [];

    const unassignedGuests = initialSchedule.direction === 'arrival'
      ? unassignedArrivals
      : unassignedDepartures;

    if (!unassignedGuests) return [];

    // Extract flight numbers from notes
    const flightMatch = initialSchedule.notes?.match(/Flights?: ([^-]+)/);
    const flightCodes = flightMatch
      ? flightMatch[1].split(',').map((f: string) => f.trim().split(' ')[0])
      : [];

    // Get guests already assigned
    const assignedGuestIds = new Set(
      freshScheduleData?.assignments?.map((a: { guest: { id: string } }) => a.guest?.id) ||
      initialSchedule.assignments?.map(a => a.guest.id) || []
    );

    // Filter to get suggested guests (matching flights and not already assigned)
    const suggestions = unassignedGuests
      .filter((guest: { id: string; arrivalFlightNumber?: string | null; departureFlightNumber?: string | null }) => {
        if (assignedGuestIds.has(guest.id)) return false;

        const guestFlight = initialSchedule.direction === 'arrival'
          ? guest.arrivalFlightNumber
          : guest.departureFlightNumber;

        // Prioritize matching flights
        if (flightCodes.length > 0 && guestFlight) {
          return flightCodes.some((code: string) => guestFlight.includes(code));
        }

        return true;
      })
      .slice(0, 5); // Limit to 5 suggestions

    return suggestions;
  }, [initialSchedule, unassignedArrivals, unassignedDepartures, freshScheduleData]);

  if (!schedule) return null;

  const vehicleType = schedule.vehicle?.vehicleType || schedule.vehicle?.type || 'vehicle';
  const assignedCount = schedule.assignments?.length || 0;
  const capacity = schedule.vehicle?.capacity || 0;
  const availableSpots = Math.max(0, capacity - assignedCount);
  const isFull = availableSpots === 0;

  const getVehicleStyle = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bus':
        return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' };
      case 'van':
        return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
      case 'mpv':
        return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' };
      case 'starex':
        return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' };
      case 'sedan':
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    }
  };

  const style = getVehicleStyle(vehicleType);

  const handleRemoveGuest = (assignmentId: string) => {
    setRemovingId(assignmentId);
    unassignMutation.mutate({ id: assignmentId });
  };

  const handleAddGuest = (guestId: string) => {
    assignMutation.mutate({
      guestId,
      scheduleId: schedule.id,
      assignmentType: schedule.direction,
    });
  };

  const handleQuickAssign = (guestId: string) => {
    setAssigningGuestId(guestId);
    assignMutation.mutate({
      guestId,
      scheduleId: schedule.id,
      assignmentType: schedule.direction,
    });
  };

  // Extract flights from notes
  const flightMatch = schedule.notes?.match(/Flights?: ([^-]+)/);
  const flights = flightMatch ? flightMatch[1].trim() : '';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-2xl px-0"
        >
          <SheetHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', style.bg)}>
                  <Bus className={cn('h-5 w-5', style.text)} />
                </div>
                <div>
                  <SheetTitle className="text-left">
                    {schedule.vehicle?.name || 'Vehicle TBD'}
                  </SheetTitle>
                  <SheetDescription className="text-left">
                    {schedule.pickupTime?.slice(0, 5)} pickup
                  </SheetDescription>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  'text-sm font-medium',
                  isFull
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                )}
              >
                {assignedCount}/{capacity}
              </Badge>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 h-[calc(85vh-140px)]">
            <div className="px-4 space-y-4">
              {/* Schedule Info */}
              <div className={cn('rounded-lg p-4', style.bg, 'bg-opacity-50')}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className={cn('h-4 w-4', style.text)} />
                    <span className="text-sm font-medium">
                      {schedule.pickupTime?.slice(0, 5)}
                    </span>
                  </div>

                  {schedule.pickupLocation && (
                    <div className="flex items-start gap-3">
                      <MapPin className={cn('h-4 w-4 mt-0.5 shrink-0', style.text)} />
                      <span className="text-sm">
                        {schedule.pickupLocation}
                        {schedule.dropoffLocation && (
                          <>
                            <span className="text-muted-foreground"> to </span>
                            {schedule.dropoffLocation}
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {flights && (
                    <div className="flex items-start gap-3">
                      <Plane className={cn('h-4 w-4 mt-0.5 shrink-0', style.text)} />
                      <span className="text-sm">{flights}</span>
                    </div>
                  )}

                  {schedule.vehicle?.driverPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className={cn('h-4 w-4', style.text)} />
                      <a
                        href={`tel:${schedule.vehicle.driverPhone}`}
                        className="text-sm text-blue-600 underline"
                      >
                        {schedule.vehicle.driverName || 'Driver'}: {schedule.vehicle.driverPhone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">
                    {availableSpots} spot{availableSpots !== 1 ? 's' : ''} available
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      isFull ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${Math.min((assignedCount / capacity) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Quick Assign Section */}
              {!isFull && suggestedGuests.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 p-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Quick Assign
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">
                      Suggested guests
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <AnimatePresence mode="popLayout">
                      {suggestedGuests.map((guest: { id: string; firstName: string; lastName: string; arrivalFlightNumber?: string | null; departureFlightNumber?: string | null }) => {
                        const flightNumber = schedule.direction === 'arrival'
                          ? guest.arrivalFlightNumber
                          : guest.departureFlightNumber;
                        const isAssigning = assigningGuestId === guest.id;

                        return (
                          <motion.button
                            key={guest.id}
                            initial={false}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => handleQuickAssign(guest.id)}
                            disabled={isAssigning || assignMutation.isPending}
                            className={cn(
                              'flex flex-col items-start px-3 py-2 rounded-lg text-left transition-all min-w-0',
                              'bg-white dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700',
                              'hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-300 hover:shadow-sm',
                              'active:scale-95',
                              (isAssigning || assignMutation.isPending) && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-center gap-1.5 w-full min-w-0">
                              {isAssigning ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              )}
                              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate">
                                {guest.firstName} {guest.lastName?.charAt(0)}.
                              </span>
                            </div>
                            {flightNumber && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 w-full min-w-0">
                                <Plane className="h-3 w-3 shrink-0" />
                                <span className="truncate">{flightNumber}</span>
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGuestSelector(true)}
                    className="w-full mt-3 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View all unassigned guests
                  </Button>
                </div>
              )}

              <Separator />

              {/* Guest List Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Passengers</span>
                  <Badge variant="outline" className="ml-1">
                    {assignedCount}
                  </Badge>
                </div>
                {!isFull && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGuestSelector(true)}
                    className="gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add
                  </Button>
                )}
              </div>

              {/* Guest List */}
              {assignedCount === 0 ? (
                <div className="py-8 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No passengers assigned</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowGuestSelector(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add passengers
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedule.assignments?.map((assignment: { id: string; guest: { firstName: string; lastName: string; arrivalFlightNumber?: string | null; departureFlightNumber?: string | null } }) => {
                    const isRemoving = removingId === assignment.id;
                    const flightNumber =
                      schedule.direction === 'arrival'
                        ? assignment.guest.arrivalFlightNumber
                        : assignment.guest.departureFlightNumber;

                    return (
                      <div
                        key={assignment.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg bg-muted/50 transition-opacity',
                          isRemoving && 'opacity-50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {assignment.guest.firstName} {assignment.guest.lastName}
                          </div>
                          {flightNumber && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Plane className="h-3 w-3" />
                              {flightNumber}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveGuest(assignment.id)}
                          disabled={isRemoving}
                        >
                          {isRemoving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer Action */}
          {!isFull && assignedCount > 0 && (
            <div className="px-4 py-3 border-t bg-background">
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowGuestSelector(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add more passengers
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Guest Selector Sheet */}
      <GuestSelector
        open={showGuestSelector}
        onOpenChange={setShowGuestSelector}
        scheduleId={schedule.id}
        direction={schedule.direction}
        scheduleDate={schedule.scheduleDate}
        onSelect={handleAddGuest}
        isLoading={assignMutation.isPending}
        excludeGuestIds={schedule.assignments?.map((a: { guest: { id: string } }) => a.guest.id) || []}
      />
    </>
  );
}
