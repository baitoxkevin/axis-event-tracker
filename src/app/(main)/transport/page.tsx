/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import {
  ChevronLeft,
  ChevronRight,
  Bus,
  Plane,
  Users,
  MapPin,
  AlertTriangle,
  Clock,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { format, addDays, subDays, parseISO, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScheduleDetailSheet } from '@/components/transport/schedule-detail-sheet';
import { motion } from 'framer-motion';
import { isMidnightSurchargeTime } from '@/lib/transport-rules';

// Event date range - Jan 18-23, 2026
const EVENT_START_DATE = new Date('2026-01-18');
const EVENT_END_DATE = new Date('2026-01-23');

// Type for schedule data
type Schedule = {
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
};

function TransportPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasScrolled = useRef(false);

  // Get flight and highlight params for navigation from FlightMismatchAlert
  const highlightedFlight = searchParams.get('flight');
  const showMismatchOnly = searchParams.get('mismatch') === 'true';

  // Initialize date from URL param or default to Jan 18, 2026 (event date)
  const initialDate = useMemo(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const parsed = parseISO(dateParam);
        // Clamp to event range
        if (isBefore(parsed, EVENT_START_DATE)) return EVENT_START_DATE;
        if (isAfter(parsed, EVENT_END_DATE)) return EVENT_END_DATE;
        return parsed;
      } catch {
        return new Date('2026-01-18');
      }
    }
    return new Date('2026-01-18');
  }, [searchParams]);

  // Initialize direction from URL param
  const initialDirection = useMemo(() => {
    const dirParam = searchParams.get('direction');
    if (dirParam === 'arrival' || dirParam === 'departure') return dirParam;
    return 'arrival';
  }, [searchParams]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [direction, setDirection] = useState<'arrival' | 'departure'>(initialDirection);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [highlightedScheduleIds, setHighlightedScheduleIds] = useState<Set<string>>(new Set());

  // Store last viewed dates for each direction
  const lastArrivalDateRef = useRef<string>('2026-01-18');
  const lastDepartureDateRef = useRef<string>('2026-01-21');

  // Fetch schedules from database
  const { data: schedules, isLoading, refetch } = trpc.transport.schedules.list.useQuery({
    dateFrom: format(selectedDate, 'yyyy-MM-dd'),
    dateTo: format(selectedDate, 'yyyy-MM-dd'),
    direction,
  });

  // Fetch pre-planned transport groups
  const { data: prePlannedGroups, isLoading: isLoadingPrePlanned } = trpc.transport.prePlannedGroups.getByDate.useQuery({
    date: format(selectedDate, 'yyyy-MM-dd'),
  });

  // Filter pre-planned groups by direction
  const filteredPrePlannedGroups = useMemo(() => {
    if (!prePlannedGroups) return null;
    if (prePlannedGroups.direction !== direction) return null;
    return prePlannedGroups;
  }, [prePlannedGroups, direction]);

  // Use pre-planned groups when no database schedules exist and direction matches
  const hasDbSchedules = schedules && schedules.length > 0;
  const showPrePlanned = !hasDbSchedules && filteredPrePlannedGroups && filteredPrePlannedGroups.groups.length > 0;

  // Effect to highlight and scroll to schedules with the specified flight
  useEffect(() => {
    if (!schedules || hasScrolled.current) return;

    if (highlightedFlight || showMismatchOnly) {
      // Find schedules that have guests with the highlighted flight number
      const matchingScheduleIds = new Set<string>();

      schedules.forEach((schedule) => {
        const hasMatchingGuest = schedule.assignments?.some((assignment: { guest: { arrivalFlightNumber?: string | null; departureFlightNumber?: string | null } }) => {
          const flightNumber = schedule.direction === 'arrival'
            ? assignment.guest.arrivalFlightNumber
            : assignment.guest.departureFlightNumber;
          return highlightedFlight
            ? flightNumber === highlightedFlight
            : flightNumber; // For mismatch mode, just show any with flight numbers
        });

        if (hasMatchingGuest) {
          matchingScheduleIds.add(schedule.id);
        }
      });

      if (matchingScheduleIds.size > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHighlightedScheduleIds(matchingScheduleIds);

        // Scroll to the first matching schedule after a short delay
        const firstScheduleId = Array.from(matchingScheduleIds)[0];
        setTimeout(() => {
          const element = cardRefs.current[firstScheduleId];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            hasScrolled.current = true;
          }
        }, 300);
      }
    }
  }, [schedules, highlightedFlight, showMismatchOnly]);

  // Clear highlight when navigating away or changing params
  useEffect(() => {
    if (!highlightedFlight && !showMismatchOnly) {
      setHighlightedScheduleIds(new Set());
      hasScrolled.current = false;
    }
  }, [highlightedFlight, showMismatchOnly]);

  // Check if navigation is allowed
  const canNavigatePrev = !isBefore(subDays(selectedDate, 1), EVENT_START_DATE);
  const canNavigateNext = !isAfter(addDays(selectedDate, 1), EVENT_END_DATE);

  // Navigation
  const navigateDate = (dir: 'prev' | 'next') => {
    const newDate = dir === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
    // Clamp to event range
    if (isBefore(newDate, EVENT_START_DATE) || isAfter(newDate, EVENT_END_DATE)) return;
    setSelectedDate(newDate);
    router.replace(`/transport?date=${format(newDate, 'yyyy-MM-dd')}&direction=${direction}`, { scroll: false });
  };

  // Handle direction change
  const handleDirectionChange = (newDirection: 'arrival' | 'departure') => {
    if (newDirection === direction) return;

    // Save current date for the direction we're leaving
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    if (direction === 'arrival') {
      lastArrivalDateRef.current = dateString;
    } else {
      lastDepartureDateRef.current = dateString;
    }

    setDirection(newDirection);

    // Navigate to appropriate date for the new direction
    let targetDate: string;
    if (newDirection === 'arrival') {
      targetDate = lastArrivalDateRef.current;
    } else {
      targetDate = lastDepartureDateRef.current;
    }

    const newDate = parseISO(targetDate);
    setSelectedDate(newDate);
    router.replace(`/transport?date=${targetDate}&direction=${newDirection}`, { scroll: false });
  };

  // Get vehicle type styling with rich visual design
  const getVehicleStyle = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bus':
        return {
          accent: 'bg-gradient-to-b from-blue-500 to-blue-600',
          bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          border: 'border-blue-200/60 dark:border-blue-800/40',
          badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50',
          shadow: 'shadow-blue-500/10',
        };
      case 'van':
        return {
          accent: 'bg-gradient-to-b from-emerald-500 to-emerald-600',
          bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20',
          text: 'text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-200/60 dark:border-emerald-800/40',
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
          shadow: 'shadow-emerald-500/10',
        };
      case 'mpv':
        return {
          accent: 'bg-gradient-to-b from-violet-500 to-violet-600',
          bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20',
          text: 'text-violet-700 dark:text-violet-300',
          border: 'border-violet-200/60 dark:border-violet-800/40',
          badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700',
          iconBg: 'bg-violet-100 dark:bg-violet-900/50',
          shadow: 'shadow-violet-500/10',
        };
      case 'starex':
        return {
          accent: 'bg-gradient-to-b from-amber-500 to-amber-600',
          bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',
          text: 'text-amber-700 dark:text-amber-300',
          border: 'border-amber-200/60 dark:border-amber-800/40',
          badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
          iconBg: 'bg-amber-100 dark:bg-amber-900/50',
          shadow: 'shadow-amber-500/10',
        };
      case 'sedan':
        return {
          accent: 'bg-gradient-to-b from-slate-500 to-slate-600',
          bg: 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/40 dark:to-slate-900/20',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-200/60 dark:border-slate-800/40',
          badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          iconBg: 'bg-slate-100 dark:bg-slate-900/50',
          shadow: 'shadow-slate-500/10',
        };
      default:
        return {
          accent: 'bg-gradient-to-b from-sky-500 to-sky-600',
          bg: 'bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-sky-900/20',
          text: 'text-sky-700 dark:text-sky-300',
          border: 'border-sky-200/60 dark:border-sky-800/40',
          badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700',
          iconBg: 'bg-sky-100 dark:bg-sky-900/50',
          shadow: 'shadow-sky-500/10',
        };
    }
  };

  // Get capacity status styling
  const getCapacityStyle = (assigned: number, capacity: number) => {
    const percentage = capacity > 0 ? (assigned / capacity) * 100 : 0;
    if (percentage >= 100) {
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        ring: 'ring-emerald-500/20',
        label: 'Full',
      };
    }
    if (percentage >= 75) {
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        text: 'text-amber-700 dark:text-amber-300',
        ring: 'ring-amber-500/20',
        label: 'Almost full',
      };
    }
    if (percentage >= 50) {
      return {
        bg: 'bg-sky-100 dark:bg-sky-900/40',
        text: 'text-sky-700 dark:text-sky-300',
        ring: 'ring-sky-500/20',
        label: 'Half full',
      };
    }
    return {
      bg: 'bg-slate-100 dark:bg-slate-800/60',
      text: 'text-slate-600 dark:text-slate-400',
      ring: 'ring-slate-500/10',
      label: 'Available',
    };
  };

  // Handle card click
  const handleScheduleClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setSheetOpen(true);
  };

  // Handle update callback
  const handleScheduleUpdate = () => {
    refetch();
  };

  // Calculate totals
  const totalPassengers = showPrePlanned
    ? filteredPrePlannedGroups?.totalPax || 0
    : schedules?.reduce((acc, s) => acc + (s.assignments?.length || 0), 0) || 0;

  const totalCapacity = showPrePlanned
    ? filteredPrePlannedGroups?.totalPax || 0
    : schedules?.reduce((acc, s) => acc + (s.vehicle?.capacity || 0), 0) || 0;

  const totalTrips = showPrePlanned
    ? filteredPrePlannedGroups?.totalGroups || 0
    : schedules?.length || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50">
              <Bus className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Transport Schedule</h1>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('prev')}
            disabled={!canNavigatePrev}
            className="h-9 w-9 p-0 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </Button>

          <div className="text-center">
            <div className="font-semibold text-slate-900 dark:text-white">{format(selectedDate, 'EEEE')}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {format(selectedDate, 'MMM d, yyyy')}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('next')}
            disabled={!canNavigateNext}
            className="h-9 w-9 p-0 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </Button>
        </div>

        {/* Direction Toggle */}
        <div className="px-4 py-3">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDirectionChange('arrival')}
              className={cn(
                'flex-1 rounded-lg h-9 transition-all',
                direction === 'arrival'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600 dark:text-sky-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <ArrowDownToLine className={cn(
                'h-4 w-4 mr-2',
                direction === 'arrival' && 'text-sky-500'
              )} />
              Arrivals
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDirectionChange('departure')}
              className={cn(
                'flex-1 rounded-lg h-9 transition-all',
                direction === 'departure'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-orange-600 dark:text-orange-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <ArrowUpFromLine className={cn(
                'h-4 w-4 mr-2',
                direction === 'departure' && 'text-orange-500'
              )} />
              Departures
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {(schedules || showPrePlanned) && (
          <div className="flex justify-center gap-6 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-violet-100 dark:bg-violet-900/40">
                <Bus className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm">
                <span className="font-bold text-slate-900 dark:text-white">{totalTrips}</span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">trips</span>
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-sky-100 dark:bg-sky-900/40">
                <Users className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-sm">
                <span className="font-bold text-slate-900 dark:text-white">{totalPassengers}</span>
                {!showPrePlanned && <span className="text-slate-500 dark:text-slate-400">/{totalCapacity}</span>}
                <span className="text-slate-500 dark:text-slate-400 ml-1">pax</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Schedule List */}
      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          // Loading skeleton with shimmer animation
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40">
                  {/* Left accent bar skeleton */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />

                  <div className="p-4 pl-5">
                    {/* Header row skeleton */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-14 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                        <div className="h-7 w-20 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      </div>
                      <div className="h-8 w-16 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                    </div>

                    {/* Flight chips skeleton */}
                    <div className="flex gap-1.5 mb-3">
                      <div className="h-5 w-5 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      <div className="h-5 w-24 rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      <div className="h-5 w-20 rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                    </div>

                    {/* Route skeleton */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      <div className="h-4 w-24 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      <div className="h-4 w-4 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      <div className="h-4 w-28 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-100 dark:bg-slate-700/50 mb-3" />

                    {/* Footer skeleton */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                        </div>
                        <div className="h-3 w-20 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      </div>
                      <div className="h-5 w-16 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : showPrePlanned ? (
          // Pre-planned transport groups display
          <div className="space-y-4">
            {/* Info banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl p-3 border border-amber-200/60 dark:border-amber-800/40">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Pre-Planned Schedule • {filteredPrePlannedGroups?.direction === 'arrival' ? 'Arrivals' : 'Departures'}
                </span>
              </div>
            </div>

            {filteredPrePlannedGroups?.groups.map((group, index) => {
              const style = getVehicleStyle(group.vehicleType.toLowerCase());
              const hasMidnightSurcharge = isMidnightSurchargeTime(group.transportTime);

              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
                >
                  <div
                    className={cn(
                      'relative rounded-2xl overflow-hidden',
                      'bg-white dark:bg-slate-800',
                      'border shadow-sm',
                      style.border,
                      style.shadow
                    )}
                  >
                    {/* Left accent bar */}
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl', style.accent)} />

                    {/* Midnight surcharge banner */}
                    {hasMidnightSurcharge && (
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 px-4 py-2 border-b border-violet-200/60 dark:border-violet-800/40 flex items-center gap-2">
                        <span className="text-lg">🌙</span>
                        <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                          Midnight Surcharge Hours
                        </span>
                      </div>
                    )}

                    {/* Main content */}
                    <div className="p-4 pl-5">
                      {/* Header: Time + Vehicle */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          {/* Gather Time -> Transport Time */}
                          <div className="flex items-center gap-2">
                            <div className="text-center">
                              <div className="text-xs text-slate-500 dark:text-slate-400">Gather</div>
                              <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {group.gatherTime}
                              </span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <div className="text-center">
                              <div className="text-xs text-slate-500 dark:text-slate-400">Depart</div>
                              <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {group.transportTime}
                              </span>
                            </div>
                          </div>

                          {/* Vehicle Badge */}
                          <div className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
                            style.badge
                          )}>
                            <Bus className={cn('h-3.5 w-3.5', style.text)} />
                            <span className={cn('text-sm font-semibold', style.text)}>
                              {group.vehicleInfo?.name || group.vehicleType}
                            </span>
                          </div>
                        </div>

                        {/* Pax Count */}
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-xl',
                          style.bg
                        )}>
                          <Users className={cn('h-4 w-4', style.text)} />
                          <span className={cn('text-sm font-bold', style.text)}>
                            {group.combinedPax} pax
                          </span>
                        </div>
                      </div>

                      {/* Flight Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Plane className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                        </div>
                        {group.flights.slice(0, 5).map((flight, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40"
                          >
                            {flight}
                          </span>
                        ))}
                        {group.flights.length > 5 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 self-center">
                            +{group.flights.length - 5} more
                          </span>
                        )}
                      </div>

                      {/* T2 indicator or Remark */}
                      {(group.isT2 || group.remark) && (
                        <div className="flex items-center gap-2 text-xs">
                          {group.isT2 && (
                            <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-medium">
                              Terminal 2
                            </span>
                          )}
                          {group.remark && (
                            <span className="text-slate-500 dark:text-slate-400 italic">
                              {group.remark}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : schedules?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-900/30 dark:to-violet-900/30 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10">
              <Bus className="h-10 w-10 text-sky-500 dark:text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No Schedules</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
              There are no transport schedules for this date. Try selecting a different day.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {schedules?.map((schedule) => {
              const vehicle = schedule.vehicle as { type?: string; vehicleType?: string; capacity?: number } | null;
              const vehicleType = vehicle?.type || vehicle?.vehicleType || '';
              const style = getVehicleStyle(vehicleType);
              const assignedCount = schedule.assignments?.length || 0;
              const capacity = schedule.vehicle?.capacity || 0;
              const isFull = assignedCount >= capacity;
              const capacityStyle = getCapacityStyle(assignedCount, capacity);
              const capacityPercentage = capacity > 0 ? Math.min((assignedCount / capacity) * 100, 100) : 0;

              // Extract flight codes from notes with passenger counts
              const flightMatch = schedule.notes?.match(/Flights?: ([^-]+)/);
              const flights = flightMatch ? flightMatch[1].trim() : '';

              // Parse individual flights for better display
              const flightList = flights ? flights.split(',').map((f: string) => f.trim()).filter(Boolean) : [];

              // Get first few guest names
              const guestPreview = schedule.assignments?.slice(0, 2) || [];
              const moreCount = Math.max(0, assignedCount - 2);

              const isHighlighted = highlightedScheduleIds.has(schedule.id);

              return (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  layout
                  ref={(el) => {
                    cardRefs.current[schedule.id] = el;
                  }}
                >
                  <div
                    className={cn(
                      'relative rounded-2xl overflow-hidden cursor-pointer',
                      'bg-white dark:bg-slate-800',
                      'border shadow-sm hover:shadow-lg transition-all duration-300',
                      'active:scale-[0.98]',
                      style.border,
                      style.shadow,
                      isHighlighted && 'ring-2 ring-amber-400 ring-offset-2 shadow-lg shadow-amber-200/50'
                    )}
                    onClick={() => handleScheduleClick(schedule as Schedule)}
                  >
                    {/* Left accent bar with gradient */}
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl', style.accent)} />

                    {/* Highlighted flight warning banner */}
                    {isHighlighted && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-800/40 flex items-center gap-2.5">
                        <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-900/50">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          Flight time mismatch - review transport timing
                        </span>
                      </div>
                    )}

                    {/* Main Card Content */}
                    <div className="p-4 pl-5">
                      {/* Header Row: Time + Vehicle | Capacity */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        {/* Left: Time + Vehicle Badge */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Time Display - Prominent */}
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                              {schedule.pickupTime?.slice(0, 5)}
                            </span>
                          </div>

                          {/* Vehicle Badge - Modern pill style */}
                          <div className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
                            style.badge
                          )}>
                            <Bus className={cn('h-3.5 w-3.5', style.text)} />
                            <span className={cn('text-sm font-semibold', style.text)}>
                              {schedule.vehicle?.name || 'TBD'}
                            </span>
                          </div>
                        </div>

                        {/* Right: Capacity Indicator - Visual ring */}
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-xl ring-1',
                          capacityStyle.bg,
                          capacityStyle.ring
                        )}>
                          <div className="relative">
                            {/* Circular progress indicator */}
                            <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                              <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-slate-200 dark:text-slate-700"
                              />
                              <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray={`${capacityPercentage * 0.502} 50.2`}
                                strokeLinecap="round"
                                className={cn(
                                  isFull ? 'text-emerald-500' :
                                  capacityPercentage >= 75 ? 'text-amber-500' :
                                  capacityPercentage >= 50 ? 'text-sky-500' :
                                  'text-slate-400'
                                )}
                              />
                            </svg>
                            <Users className="h-2.5 w-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                          </div>
                          <span className={cn('text-sm font-bold tabular-nums', capacityStyle.text)}>
                            {assignedCount}/{capacity}
                          </span>
                        </div>
                      </div>

                      {/* Flight Tags - Compact chips */}
                      {flightList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <Plane className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
                          </div>
                          {flightList.slice(0, 4).map((flight: string, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40"
                            >
                              {flight}
                            </span>
                          ))}
                          {flightList.length > 4 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 self-center">
                              +{flightList.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Route - Clean layout with arrow */}
                      <div className="flex items-center gap-2 text-sm mb-3">
                        <div className={cn('p-1.5 rounded-lg', style.iconBg)}>
                          <MapPin className={cn('h-3.5 w-3.5', style.text)} />
                        </div>
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                          {schedule.pickupLocation}
                        </span>
                        {schedule.dropoffLocation && (
                          <>
                            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                              <div className="w-4 h-px bg-slate-300 dark:bg-slate-600" />
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                              {schedule.dropoffLocation}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-3" />

                      {/* Footer: Guest Preview | Action Hint */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Guest Preview */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {assignedCount > 0 ? (
                            <>
                              {/* Avatar stack */}
                              <div className="flex -space-x-1.5">
                                {guestPreview.slice(0, 3).map((a: { id: string; guest: { firstName: string; lastName: string } }, idx: number) => (
                                  <div
                                    key={a.id}
                                    className={cn(
                                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-white dark:ring-slate-800',
                                      idx === 0 ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' :
                                      idx === 1 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' :
                                      'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                    )}
                                    style={{ zIndex: 3 - idx }}
                                  >
                                    {a.guest.firstName[0]}{a.guest.lastName[0]}
                                  </div>
                                ))}
                                {moreCount > 0 && (
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 ring-2 ring-white dark:ring-slate-800"
                                    style={{ zIndex: 0 }}
                                  >
                                    +{moreCount}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {guestPreview.map((a: { id: string; guest: { firstName: string } }, i: number) => (
                                  <span key={a.id}>
                                    {a.guest.firstName}
                                    {i < guestPreview.length - 1 && ', '}
                                  </span>
                                ))}
                                {moreCount > 0 && ` +${moreCount}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                              No guests assigned
                            </span>
                          )}
                        </div>

                        {/* Action Indicator */}
                        {isFull ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              Full
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <span className="text-xs">Tap to assign</span>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Detail Sheet */}
      <ScheduleDetailSheet
        schedule={selectedSchedule}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            // Refetch when sheet closes to get latest data
            refetch();
          }
        }}
        onUpdate={handleScheduleUpdate}
      />
    </div>
  );
}

export default function TransportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 pb-24 px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl" />)}
          </div>
        </div>
      </div>
    }>
      <TransportPageContent />
    </Suspense>
  );
}
