'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  Plane,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DelayImpactPanelProps {
  date: string;
  direction?: 'arrival' | 'departure';
}

export function DelayImpactPanel({ date, direction }: DelayImpactPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<{
    id: string;
    name: string;
    currentScheduleId?: string;
    assignmentType: 'arrival' | 'departure';
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: delayData, isLoading, refetch } = trpc.transport.dashboard.delayedFlights.useQuery(
    { date, direction },
    { refetchInterval: 60000 } // Refresh every minute
  );

  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.transport.dashboard.suggestReallocation.useQuery(
      {
        guestId: selectedGuest?.id || '',
        direction: selectedGuest?.assignmentType || 'arrival',
      },
      { enabled: !!selectedGuest }
    );

  const reassignMutation = trpc.transport.dashboard.reassignGuest.useMutation({
    onSuccess: () => {
      toast.success('Guest reassigned successfully');
      setSelectedGuest(null);
      utils.transport.dashboard.delayedFlights.invalidate();
      utils.transport.schedules.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Loading delay information...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!delayData || delayData.delayedGuests.length === 0) {
    return null; // Don't show panel if no delays
  }

  const hasImpactedGuests = delayData.delayedGuests.length > 0;
  const impactedWithAssignments = delayData.delayedGuests.filter(
    (g) => g.currentAssignments.length > 0
  );

  return (
    <>
      <Card
        className={cn(
          'border-amber-200 bg-amber-50/50',
          impactedWithAssignments.length > 0 && 'border-red-200 bg-red-50/50'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  impactedWithAssignments.length > 0
                    ? 'text-red-500'
                    : 'text-amber-500'
                )}
              />
              Flight Delays Detected
              <Badge
                variant="secondary"
                className={cn(
                  impactedWithAssignments.length > 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                )}
              >
                {delayData.delayedGuests.length} affected
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-7 px-2"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-7 px-2"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0">
            {impactedWithAssignments.length > 0 && (
              <div className="mb-3 rounded-md bg-red-100/50 p-2 text-sm text-red-800">
                <strong>{impactedWithAssignments.length}</strong> guest(s) with
                delays have scheduled transport that may need adjustment.
              </div>
            )}

            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {delayData.delayedGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between rounded-md border bg-white p-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{guest.name}</span>
                        {guest.arrivalStatus === 'cancelled' && (
                          <Badge variant="destructive" className="text-xs">
                            Cancelled
                          </Badge>
                        )}
                        {guest.arrivalTimeMismatch && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-xs text-amber-800"
                          >
                            Time Changed
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Plane className="h-3 w-3" />
                          {guest.arrivalFlight || guest.departureFlight}
                        </span>
                        {guest.arrivalTimeMismatch && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span className="line-through">
                              {guest.arrivalTime}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium text-amber-700">
                              {guest.arrivalVerifiedTime}
                            </span>
                          </span>
                        )}
                        {guest.currentAssignments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Bus className="h-3 w-3" />
                            {guest.currentAssignments[0].vehicleName} @{' '}
                            {guest.currentAssignments[0].scheduledPickup}
                          </span>
                        )}
                      </div>
                    </div>
                    {guest.currentAssignments.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2"
                        onClick={() =>
                          setSelectedGuest({
                            id: guest.id,
                            name: guest.name,
                            currentScheduleId:
                              guest.currentAssignments[0].scheduleId,
                            assignmentType: guest.currentAssignments[0]
                              .type as 'arrival' | 'departure',
                          })
                        }
                      >
                        Reassign
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {delayData.availableCapacity.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Available Capacity for Reallocation:
                </p>
                <div className="flex flex-wrap gap-2">
                  {delayData.availableCapacity.slice(0, 5).map((slot) => (
                    <Badge
                      key={slot.scheduleId}
                      variant="outline"
                      className="text-xs"
                    >
                      {slot.vehicleName} @ {slot.pickupTime}
                      <span className="ml-1 text-green-600">
                        ({slot.availableSpots} spots)
                      </span>
                    </Badge>
                  ))}
                  {delayData.availableCapacity.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{delayData.availableCapacity.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Reassignment Dialog */}
      <Dialog
        open={!!selectedGuest}
        onOpenChange={(open) => !open && setSelectedGuest(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reassign {selectedGuest?.name}</DialogTitle>
            <DialogDescription>
              Select a new vehicle schedule for this guest. Schedules are sorted
              by best match based on timing.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            <div className="space-y-2 pr-4">
              {suggestionsLoading ? (
                <p className="py-4 text-center text-muted-foreground">
                  Finding best options...
                </p>
              ) : suggestions?.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  No available schedules with capacity found.
                </p>
              ) : (
                suggestions?.map((suggestion) => (
                  <div
                    key={suggestion.scheduleId}
                    className={cn(
                      'flex items-center justify-between rounded-md border p-3',
                      suggestion.isRecommended && 'border-green-200 bg-green-50/50'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {suggestion.vehicleName}
                        </span>
                        {suggestion.isRecommended && (
                          <Badge className="bg-green-100 text-xs text-green-800">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {suggestion.pickupTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {suggestion.currentCount}/{suggestion.capacity}
                        </span>
                        {suggestion.timeDifferenceMinutes > 0 && (
                          <span
                            className={cn(
                              'text-xs',
                              suggestion.timeDifferenceMinutes <= 30
                                ? 'text-green-600'
                                : suggestion.timeDifferenceMinutes <= 60
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            )}
                          >
                            {suggestion.timeDifferenceMinutes} min difference
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedGuest?.currentScheduleId) {
                          reassignMutation.mutate({
                            guestId: selectedGuest.id,
                            fromScheduleId: selectedGuest.currentScheduleId,
                            toScheduleId: suggestion.scheduleId,
                            assignmentType: selectedGuest.assignmentType,
                          });
                        }
                      }}
                      disabled={reassignMutation.isPending}
                    >
                      {reassignMutation.isPending ? 'Moving...' : 'Move Here'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
