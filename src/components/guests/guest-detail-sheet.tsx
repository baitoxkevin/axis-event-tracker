'use client';

import { useState } from 'react';
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
import { trpc } from '@/lib/trpc/client';
import {
  User,
  Mail,
  Building2,
  MapPin,
  Plane,
  Hotel,
  Bus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Edit3,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  Navigation,
  DoorOpen,
  Bed,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

// Guest type based on the tRPC response
interface Guest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  axisEmail?: string | null;
  salutation?: string | null;
  gender?: string | null;
  reportingLevel1?: string | null;
  reportingLevel2?: string | null;
  reportingLevel3?: string | null;
  function?: string | null;
  location?: string | null;
  arrivalDate?: string | null;
  arrivalTime?: string | null;
  arrivalFlightNumber?: string | null;
  arrivalAirport?: string | null;
  departureDate?: string | null;
  departureTime?: string | null;
  departureFlightNumber?: string | null;
  departureAirport?: string | null;
  hotelCheckinDate?: string | null;
  hotelCheckoutDate?: string | null;
  hotelRoomNumber?: string | null;
  hotelConfirmationNumber?: string | null;
  roomType?: string | null;
  beddingPreference?: string | null;
  dietaryRequirements?: string | null;
  specialRequests?: string | null;
  tableNumber?: string | null;
  awardsMenuSelection?: string | null;
  needsArrivalTransfer?: boolean | null;
  needsDepartureTransfer?: boolean | null;
  registrationStatus?: string | null;
  transportAssignments?: Array<{
    id: string;
    assignmentType: string;
    schedule?: {
      id: string;
      scheduleDate: string;
      pickupTime: string;
      pickupLocation?: string | null;
      dropoffLocation?: string | null;
      vehicle?: {
        name: string;
        vehicleType?: string;
      } | null;
    } | null;
  }>;
}

interface GuestDetailSheetProps {
  guest: Guest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const statusConfig: Record<string, {
  gradient: string;
  bg: string;
  text: string;
  lightBg: string;
  icon: React.ReactNode;
}> = {
  confirmed: {
    gradient: 'from-emerald-500 to-green-600',
    bg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  pending: {
    gradient: 'from-amber-500 to-yellow-600',
    bg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  cancelled: {
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    lightBg: 'bg-rose-50 dark:bg-rose-950/30',
    icon: <XCircle className="h-4 w-4" />,
  },
  waitlisted: {
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    lightBg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: <Clock className="h-4 w-4" />,
  },
};

export function GuestDetailSheet({
  guest,
  open,
  onOpenChange,
  onUpdate,
}: GuestDetailSheetProps) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const updateMutation = trpc.guests.update.useMutation({
    onSuccess: () => {
      toast.success('Guest status updated');
      utils.guests.list.invalidate();
      utils.guests.stats.invalidate();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update guest');
    },
    onSettled: () => {
      setIsUpdating(null);
    },
  });

  if (!guest) return null;

  const currentStatus = guest.registrationStatus || 'pending';
  const statusStyle = statusConfig[currentStatus] || statusConfig.pending;
  const initials = `${guest.firstName?.[0] || ''}${guest.lastName?.[0] || ''}`.toUpperCase();

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) {
      toast.info(`Guest is already ${currentStatus}`);
      return;
    }
    setIsUpdating(newStatus);
    updateMutation.mutate({
      id: guest.id,
      registrationStatus: newStatus as 'pending' | 'confirmed' | 'cancelled' | 'waitlisted',
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), 'EEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return null;
    return timeStr.slice(0, 5);
  };

  // Get transport assignments
  const arrivalTransport = guest.transportAssignments?.find(
    (a) => a.assignmentType === 'arrival'
  );
  const departureTransport = guest.transportAssignments?.find(
    (a) => a.assignmentType === 'departure'
  );

  // Status action buttons configuration
  const statusActions = [
    { key: 'confirmed', label: 'Confirm', icon: <CheckCircle2 className="h-4 w-4" />, color: 'emerald' },
    { key: 'pending', label: 'Pending', icon: <AlertCircle className="h-4 w-4" />, color: 'amber' },
    { key: 'cancelled', label: 'Cancel', icon: <XCircle className="h-4 w-4" />, color: 'rose' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-3xl px-0 border-0 bg-slate-50 dark:bg-slate-900"
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header with gradient background */}
        <div className="relative overflow-hidden">
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-10',
            statusStyle.gradient
          )} />
          <SheetHeader className="px-5 pb-5 relative">
            <div className="flex items-start gap-4">
              {/* Avatar with gradient ring */}
              <div className={cn(
                'relative flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br p-[2px] shadow-lg',
                statusStyle.gradient
              )}>
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center">
                  <span className={cn('text-xl font-bold', statusStyle.text)}>
                    {initials}
                  </span>
                </div>
                <div className={cn(
                  'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-slate-50 dark:border-slate-900 flex items-center justify-center',
                  statusStyle.bg
                )}>
                  <span className="text-white">{statusStyle.icon}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <SheetTitle className="text-left text-xl font-bold text-slate-900 dark:text-white">
                  {guest.firstName} {guest.lastName}
                </SheetTitle>
                <SheetDescription className="text-left flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{guest.email}</span>
                </SheetDescription>
                <Badge
                  className={cn(
                    'mt-2 capitalize font-medium text-xs px-2.5 py-0.5 rounded-full border-0',
                    statusStyle.lightBg, statusStyle.text
                  )}
                >
                  {currentStatus}
                </Badge>
              </div>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1 h-[calc(90vh-200px)]">
          <div className="px-5 space-y-5 pb-6">
            {/* Quick Actions - Status Change */}
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Quick Actions
              </h4>
              <div className="flex gap-2">
                {statusActions.map((action) => {
                  const isActive = currentStatus === action.key;
                  const isLoading = isUpdating === action.key;
                  return (
                    <Button
                      key={action.key}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(action.key)}
                      disabled={isUpdating !== null}
                      className={cn(
                        'flex-1 rounded-xl transition-all duration-200',
                        isActive && action.color === 'emerald' && 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 border-0 shadow-lg shadow-emerald-500/20',
                        isActive && action.color === 'amber' && 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 border-0 shadow-lg shadow-amber-500/20',
                        isActive && action.color === 'rose' && 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 border-0 shadow-lg shadow-rose-500/20',
                        !isActive && 'hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600'
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <span className="mr-1.5">{action.icon}</span>
                      )}
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Organization Section */}
            {(guest.reportingLevel1 || guest.reportingLevel2 || guest.reportingLevel3 || guest.function || guest.location) && (
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/50">
                    <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Organization</h4>
                </div>
                <div className="space-y-3">
                  {guest.reportingLevel1 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5" />
                        Division
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{guest.reportingLevel1}</span>
                    </div>
                  )}
                  {guest.reportingLevel2 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5" />
                        Department
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{guest.reportingLevel2}</span>
                    </div>
                  )}
                  {guest.reportingLevel3 && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        Team
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{guest.reportingLevel3}</span>
                    </div>
                  )}
                  {guest.function && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5" />
                        Function
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{guest.function}</span>
                    </div>
                  )}
                  {guest.location && (
                    <div className="flex items-center justify-between py-2 last:border-0">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        Location
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{guest.location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Travel Details Section */}
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950/50">
                  <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Travel Details</h4>
              </div>

              {/* Arrival Card */}
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-4 mb-3 border border-sky-100 dark:border-sky-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-500/10">
                      <ArrowDownToLine className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm font-semibold text-sky-700 dark:text-sky-400">Arrival</span>
                  </div>
                  {guest.needsArrivalTransfer && (
                    <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-0 text-xs rounded-lg">
                      <Bus className="h-3 w-3 mr-1" />
                      Transfer
                    </Badge>
                  )}
                </div>
                {guest.arrivalDate ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{formatDate(guest.arrivalDate)}</span>
                      {guest.arrivalTime && (
                        <>
                          <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400 ml-2" />
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{formatTime(guest.arrivalTime)}</span>
                        </>
                      )}
                    </div>
                    {guest.arrivalFlightNumber && (
                      <div className="flex items-center gap-3">
                        <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{guest.arrivalFlightNumber}</span>
                        {guest.arrivalAirport && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            to {guest.arrivalAirport}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No arrival information</p>
                )}
              </div>

              {/* Departure Card */}
              <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 p-4 border border-orange-100 dark:border-orange-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                      <ArrowUpFromLine className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">Departure</span>
                  </div>
                  {guest.needsDepartureTransfer && (
                    <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-0 text-xs rounded-lg">
                      <Bus className="h-3 w-3 mr-1" />
                      Transfer
                    </Badge>
                  )}
                </div>
                {guest.departureDate ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{formatDate(guest.departureDate)}</span>
                      {guest.departureTime && (
                        <>
                          <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 ml-2" />
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{formatTime(guest.departureTime)}</span>
                        </>
                      )}
                    </div>
                    {guest.departureFlightNumber && (
                      <div className="flex items-center gap-3">
                        <Plane className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{guest.departureFlightNumber}</span>
                        {guest.departureAirport && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            from {guest.departureAirport}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No departure information</p>
                )}
              </div>
            </div>

            {/* Transport Assignments */}
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/50">
                  <Bus className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Transport Assignments</h4>
              </div>

              <div className="space-y-3">
                {arrivalTransport?.schedule ? (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4 border border-slate-200/50 dark:border-slate-600/50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border-0 text-xs rounded-lg">
                        <ArrowDownToLine className="h-3 w-3 mr-1" />
                        Arrival Transfer
                      </Badge>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                        {arrivalTransport.schedule.pickupTime?.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Navigation className="h-3.5 w-3.5 text-slate-400" />
                      <span>{arrivalTransport.schedule.vehicle?.name || 'Vehicle TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {arrivalTransport.schedule.pickupLocation}
                        {arrivalTransport.schedule.dropoffLocation && (
                          <> <ChevronRight className="h-3 w-3 inline" /> {arrivalTransport.schedule.dropoffLocation}</>
                        )}
                      </span>
                    </div>
                  </div>
                ) : guest.needsArrivalTransfer ? (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Arrival transfer needed - not assigned</span>
                    </div>
                  </div>
                ) : null}

                {departureTransport?.schedule ? (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4 border border-slate-200/50 dark:border-slate-600/50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-0 text-xs rounded-lg">
                        <ArrowUpFromLine className="h-3 w-3 mr-1" />
                        Departure Transfer
                      </Badge>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                        {departureTransport.schedule.pickupTime?.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Navigation className="h-3.5 w-3.5 text-slate-400" />
                      <span>{departureTransport.schedule.vehicle?.name || 'Vehicle TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {departureTransport.schedule.pickupLocation}
                        {departureTransport.schedule.dropoffLocation && (
                          <> <ChevronRight className="h-3 w-3 inline" /> {departureTransport.schedule.dropoffLocation}</>
                        )}
                      </span>
                    </div>
                  </div>
                ) : guest.needsDepartureTransfer ? (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Departure transfer needed - not assigned</span>
                    </div>
                  </div>
                ) : null}

                {!arrivalTransport && !departureTransport && !guest.needsArrivalTransfer && !guest.needsDepartureTransfer && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">No transport required</p>
                )}
              </div>
            </div>

            {/* Hotel Section - Always show */}
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50">
                  <Hotel className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Hotel</h4>
              </div>
              {(guest.hotelCheckinDate || guest.hotelCheckoutDate || guest.hotelRoomNumber || guest.roomType || guest.hotelConfirmationNumber) ? (
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 p-4 border border-purple-100 dark:border-purple-900/50">
                  <div className="space-y-3">
                    {/* Confirmation Number */}
                    {guest.hotelConfirmationNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-purple-500" />
                          Confirmation
                        </span>
                        <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                          {guest.hotelConfirmationNumber}
                        </span>
                      </div>
                    )}
                    {/* Room Type & Bedding */}
                    {(guest.roomType || guest.beddingPreference) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Bed className="h-3.5 w-3.5 text-purple-500" />
                          Room Type
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {[guest.roomType, guest.beddingPreference].filter(Boolean).join(' / ') || 'TBD'}
                        </span>
                      </div>
                    )}
                    {/* Room Number */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <DoorOpen className="h-3.5 w-3.5 text-purple-500" />
                        Room #
                      </span>
                      <span className={cn(
                        'text-sm font-medium',
                        guest.hotelRoomNumber ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 italic'
                      )}>
                        {guest.hotelRoomNumber || 'TBD'}
                      </span>
                    </div>
                    {guest.hotelCheckinDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <ArrowDownToLine className="h-3.5 w-3.5 text-purple-500" />
                          Check-in
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{formatDate(guest.hotelCheckinDate)}</span>
                      </div>
                    )}
                    {guest.hotelCheckoutDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <ArrowUpFromLine className="h-3.5 w-3.5 text-purple-500" />
                          Check-out
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{formatDate(guest.hotelCheckoutDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4 border border-slate-200/50 dark:border-slate-600/50">
                  <div className="flex items-center gap-3">
                    <DoorOpen className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400 italic">No hotel information available</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Action */}
        <div className="px-5 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80">
          <Link href={`/guests/${guest.id}`}>
            <Button
              className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-slate-100/10 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] h-12"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Guest Details
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
