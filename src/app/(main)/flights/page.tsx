/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { trpc } from '@/lib/trpc/client';
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  MessageSquare,
  Save,
} from 'lucide-react';
import { format, addDays, subDays, parseISO, parse, isBefore, isAfter } from 'date-fns';

// Event date range - Jan 18-23, 2026
const EVENT_START_DATE = new Date('2026-01-18');
const EVENT_END_DATE = new Date('2026-01-23');
import { cn } from '@/lib/utils';
import { FlightCard, FlightCardSkeleton, type FlightData } from '@/components/flights/flight-card';
import { PassengerSheet } from '@/components/flights/passenger-sheet';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

// LocalStorage keys
const STORAGE_KEY_PINNED = 'axis-flights-pinned';
const STORAGE_KEY_REMARKS = 'axis-flights-remarks';

// Helper to get storage with date-specific keys
function getStorageKey(baseKey: string, date: string, direction: string) {
  return `${baseKey}-${date}-${direction}`;
}

// Check if a flight time has passed
// Only applies when viewing today's date - future dates should show all flights
function isFlightTimePassed(flightTime: string | null, dateString: string): boolean {
  if (!flightTime) return false;

  try {
    // First check if the selected date is today
    const today = format(new Date(), 'yyyy-MM-dd');
    if (dateString !== today) {
      // Not viewing today's flights - don't filter any out
      return false;
    }

    // Parse the flight time (HH:MM format) with the selected date
    const flightDateTime = parse(
      `${dateString} ${flightTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    return isBefore(flightDateTime, new Date());
  } catch {
    return false;
  }
}

function FlightsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasInitialized = useRef(false);

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

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [direction, setDirection] = useState<'arrival' | 'departure'>('arrival');
  const [dismissedFlights, setDismissedFlights] = useState<Set<string>>(new Set());
  const [pinnedFlights, setPinnedFlights] = useState<Set<string>>(new Set());
  const [flightRemarks, setFlightRemarks] = useState<Record<string, string>>({});
  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [remarksSheetOpen, setRemarksSheetOpen] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Fetch flight date range for smart tab switching
  const { data: dateRange } = trpc.flights.getFlightDateRange.useQuery();

  // Clear dismissed state on mount (dismissed flights should show back after refresh)
  // Only load pinned state from localStorage
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Always clear dismissed flights on page mount
    setDismissedFlights(new Set());
  }, []);

  // Load pinned state and remarks from localStorage when date/direction changes
  useEffect(() => {
    const pinnedKey = getStorageKey(STORAGE_KEY_PINNED, dateString, direction);
    const remarksKey = getStorageKey(STORAGE_KEY_REMARKS, dateString, direction);

    try {
      const pinned = localStorage.getItem(pinnedKey);
      const remarks = localStorage.getItem(remarksKey);

      if (pinned) {
        setPinnedFlights(new Set(JSON.parse(pinned)));
      } else {
        setPinnedFlights(new Set());
      }

      if (remarks) {
        setFlightRemarks(JSON.parse(remarks));
      } else {
        setFlightRemarks({});
      }
    } catch (error) {
      console.error('Error loading flight preferences from localStorage:', error);
      setPinnedFlights(new Set());
      setFlightRemarks({});
    }
  }, [dateString, direction]);

  // Save pinned flights to localStorage
  const savePinned = useCallback((flights: Set<string>) => {
    const key = getStorageKey(STORAGE_KEY_PINNED, dateString, direction);
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(flights)));
    } catch (error) {
      console.error('Error saving pinned flights:', error);
    }
  }, [dateString, direction]);

  // Save remarks to localStorage
  const saveRemarks = useCallback((remarks: Record<string, string>) => {
    const key = getStorageKey(STORAGE_KEY_REMARKS, dateString, direction);
    try {
      localStorage.setItem(key, JSON.stringify(remarks));
    } catch (error) {
      console.error('Error saving flight remarks:', error);
    }
  }, [dateString, direction]);

  // Fetch flight summary data
  const { data: flights, isLoading, refetch } = trpc.flights.getFlightSummary.useQuery({
    date: dateString,
    direction,
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Check if navigation is allowed
  const canNavigatePrev = !isBefore(subDays(selectedDate, 1), EVENT_START_DATE);
  const canNavigateNext = !isAfter(addDays(selectedDate, 1), EVENT_END_DATE);

  // Navigation
  const navigateDate = (dir: 'prev' | 'next') => {
    const newDate = dir === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
    // Clamp to event range
    if (isBefore(newDate, EVENT_START_DATE) || isAfter(newDate, EVENT_END_DATE)) return;
    setSelectedDate(newDate);
    router.replace(`/flights?date=${format(newDate, 'yyyy-MM-dd')}`, { scroll: false });
  };

  // Store the last known "good" date for each direction
  const lastArrivalDateRef = useRef<string>('2026-01-18'); // Default to main event day
  const lastDepartureDateRef = useRef<string | null>(null);

  // Handle direction change - navigate to appropriate date
  const handleDirectionChange = (newDirection: 'arrival' | 'departure') => {
    if (newDirection === direction) return;

    // Save current date for the direction we're leaving
    if (direction === 'arrival') {
      lastArrivalDateRef.current = dateString;
    } else {
      lastDepartureDateRef.current = dateString;
    }

    setDirection(newDirection);

    // Determine target date for the new direction
    let targetDate: string | null = null;

    if (newDirection === 'arrival') {
      // Go back to last viewed arrival date, or default event day
      targetDate = lastArrivalDateRef.current;
    } else {
      // For departures: use last viewed departure date, or first departure date
      targetDate = lastDepartureDateRef.current || dateRange?.firstDepartureDate || null;
    }

    if (targetDate) {
      const newDate = parseISO(targetDate);
      setSelectedDate(newDate);
      router.replace(`/flights?date=${targetDate}`, { scroll: false });
    }
  };

  // Handle dismiss (only for current session, not persisted)
  const handleDismiss = (flightNumber: string) => {
    const newDismissed = new Set(dismissedFlights);
    newDismissed.add(flightNumber);
    setDismissedFlights(newDismissed);
    // Note: Not saving to localStorage anymore - dismissed flights show back after refresh
  };

  // Handle pin/unpin
  const handlePin = (flightNumber: string) => {
    const newPinned = new Set(pinnedFlights);
    if (newPinned.has(flightNumber)) {
      newPinned.delete(flightNumber);
    } else {
      newPinned.add(flightNumber);
    }
    setPinnedFlights(newPinned);
    savePinned(newPinned);
  };

  // Handle card click - open remarks sheet
  const handleCardClick = (flight: FlightData) => {
    setSelectedFlight(flight);
    setCurrentRemarks(flightRemarks[flight.flightNumber] || '');
    setRemarksSheetOpen(true);
  };

  // Handle saving remarks
  const handleSaveRemarks = () => {
    if (!selectedFlight) return;

    const newRemarks = { ...flightRemarks };
    if (currentRemarks.trim()) {
      newRemarks[selectedFlight.flightNumber] = currentRemarks.trim();
    } else {
      delete newRemarks[selectedFlight.flightNumber];
    }
    setFlightRemarks(newRemarks);
    saveRemarks(newRemarks);
    setRemarksSheetOpen(false);
    toast.success('Remarks saved');
  };

  // Open passenger sheet from remarks sheet
  const handleViewPassengers = () => {
    setRemarksSheetOpen(false);
    setSheetOpen(true);
  };

  // Filter and sort flights
  const visibleFlights = useMemo(() => {
    if (!flights) return [];

    // Filter out dismissed flights and past flights
    const filtered = flights.filter(f => {
      // Skip dismissed flights
      if (dismissedFlights.has(f.flightNumber)) return false;

      // Skip flights whose time has passed (unless pinned)
      const flightTime = f.verifiedTime || f.scheduledTime;
      if (!pinnedFlights.has(f.flightNumber) && isFlightTimePassed(flightTime, dateString)) {
        return false;
      }

      return true;
    });

    // Enhance flights with remarks
    const enhancedFlights = filtered.map(f => ({
      ...f,
      remarks: flightRemarks[f.flightNumber] || undefined,
    }));

    // Sort: pinned first, then by time
    return enhancedFlights.sort((a, b) => {
      const aPinned = pinnedFlights.has(a.flightNumber);
      const bPinned = pinnedFlights.has(b.flightNumber);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Sort by time
      const timeA = a.verifiedTime || a.scheduledTime || '';
      const timeB = b.verifiedTime || b.scheduledTime || '';
      return timeA.localeCompare(timeB);
    });
  }, [flights, dismissedFlights, pinnedFlights, flightRemarks, dateString]);

  // Calculate totals
  const totalPassengers = visibleFlights.reduce((acc, f) => acc + f.guests.length, 0);
  const dismissedCount = dismissedFlights.size;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Flight Status</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isLoading) && 'animate-spin')} />
          </Button>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('prev')}
            disabled={!canNavigatePrev}
            className="h-8 w-8 p-0 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="text-center">
            <div className="font-medium text-slate-900 dark:text-white">
              {format(selectedDate, 'EEEE')}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {format(selectedDate, 'MMM d, yyyy')}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate('next')}
            disabled={!canNavigateNext}
            className="h-8 w-8 p-0 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
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

        {/* Summary */}
        {!isLoading && (
          <div className="flex justify-center gap-4 px-4 py-2 text-sm border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-white">{visibleFlights.length}</span> flights
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-white">{totalPassengers}</span> passengers
            </span>
            {dismissedCount > 0 && (
              <span className="text-slate-400 dark:text-slate-500">
                {dismissedCount} hidden
              </span>
            )}
          </div>
        )}
      </div>

      {/* Flight Cards - Vertical scroll container */}
      <div className="px-4 py-4">
        {isLoading ? (
          // Loading skeletons - vertical list with staggered animation
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
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                <FlightCardSkeleton />
              </motion.div>
            ))}
          </motion.div>
        ) : visibleFlights.length === 0 ? (
          <div className="text-center py-16">
            <div className={cn(
              'w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4',
              direction === 'arrival'
                ? 'bg-sky-100 dark:bg-sky-900/50'
                : 'bg-orange-100 dark:bg-orange-900/50'
            )}>
              <Plane className={cn(
                'h-8 w-8',
                direction === 'arrival'
                  ? 'text-sky-500 rotate-45'
                  : 'text-orange-500 -rotate-45'
              )} />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              No {direction === 'arrival' ? 'arrivals' : 'departures'} for this date
            </p>
            {dismissedCount > 0 && (
              <Button
                variant="link"
                onClick={() => {
                  setDismissedFlights(new Set());
                }}
                className="mt-2 text-slate-400"
              >
                Show {dismissedCount} hidden flight{dismissedCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        ) : (
          // Vertical scrolling flight cards with swipe gestures
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {visibleFlights.map((flight) => (
                <motion.div
                  key={flight.flightNumber}
                  initial={false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  layout
                  layoutId={flight.flightNumber}
                >
                  <FlightCard
                    flight={flight}
                    isPinned={pinnedFlights.has(flight.flightNumber)}
                    onPin={() => handlePin(flight.flightNumber)}
                    onDismiss={() => handleDismiss(flight.flightNumber)}
                    onClick={() => handleCardClick(flight)}
                    direction={direction}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Show hidden flights button */}
      {!isLoading && dismissedCount > 0 && visibleFlights.length > 0 && (
        <div className="px-4 pb-4">
          <Button
            variant="outline"
            onClick={() => {
              setDismissedFlights(new Set());
            }}
            className="w-full rounded-xl border-dashed"
          >
            Show {dismissedCount} hidden flight{dismissedCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Remarks Sheet */}
      <Sheet open={remarksSheetOpen} onOpenChange={setRemarksSheetOpen}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[60vh] rounded-t-3xl px-0 border-0 bg-white dark:bg-slate-900"
        >
          {/* Drag indicator */}
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {selectedFlight && (
            <div className="px-5 pb-6 space-y-5">
              {/* Header */}
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2.5 rounded-xl',
                    direction === 'arrival'
                      ? 'bg-sky-50 dark:bg-sky-950/30'
                      : 'bg-orange-50 dark:bg-orange-950/30'
                  )}>
                    <Plane className={cn(
                      'h-5 w-5',
                      direction === 'arrival'
                        ? 'text-sky-500 dark:text-sky-400 rotate-45'
                        : 'text-orange-500 dark:text-orange-400 -rotate-45'
                    )} />
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-bold">
                      {selectedFlight.flightNumber}
                    </SheetTitle>
                    <SheetDescription>
                      {selectedFlight.verifiedTime || selectedFlight.scheduledTime}
                      {selectedFlight.terminal && ` - Terminal ${selectedFlight.terminal}`}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {/* Remarks Input */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <MessageSquare className="h-4 w-4" />
                  <span>Flight Remarks</span>
                </div>
                <Textarea
                  value={currentRemarks}
                  onChange={(e) => setCurrentRemarks(e.target.value)}
                  placeholder="Add notes about this flight (e.g., delays, special instructions, issues)..."
                  className="min-h-[100px] rounded-xl resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleViewPassengers}
                  className="flex-1 rounded-xl"
                >
                  View Passengers ({selectedFlight.guests.length})
                </Button>
                <Button
                  onClick={handleSaveRemarks}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Remarks
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Passenger Sheet */}
      <PassengerSheet
        flight={selectedFlight}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        direction={direction}
      />
    </div>
  );
}

export default function FlightsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 pb-24 px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl" />)}
          </div>
        </div>
      </div>
    }>
      <FlightsPageContent />
    </Suspense>
  );
}
