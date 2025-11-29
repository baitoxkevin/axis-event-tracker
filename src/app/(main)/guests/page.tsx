/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc/client';
import {
  Search,
  Upload,
  Users,
  Plane,
  Bus,
  Calendar,
  Sparkles,
  Clock,
  Loader2,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { GuestDetailSheet } from '@/components/guests/guest-detail-sheet';
import { motion, AnimatePresence } from 'framer-motion';

// Guest type based on tRPC response
type Guest = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  axisEmail?: string | null;
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
};

// Filter types
type FilterType = 'all' | 'arriving_today' | 'arriving_tomorrow' | 'needs_attention';

// Status styling - clean, minimal design matching flight cards
const statusConfig: Record<string, {
  accent: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
}> = {
  confirmed: {
    accent: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  pending: {
    accent: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    accent: 'bg-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-600 dark:text-rose-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  waitlisted: {
    accent: 'bg-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
  },
};

// Sorting options
type SortOption = 'name' | 'arrivalDate' | 'status' | 'group';
type SortDirection = 'asc' | 'desc';

export default function GuestsPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  // Fetch guests with infinite scroll
  const { data, isLoading, isFetching, refetch } = trpc.guests.list.useQuery({
    search: search || undefined,
    registrationStatus: activeFilter === 'needs_attention' ? 'pending' : undefined,
    page,
    pageSize,
  });

  // Reset and load new data when search or filter changes
  useEffect(() => {
    setAllGuests([]);
    setPage(1);
    setHasMore(true);
  }, [search, activeFilter]);

  // Append new data when it arrives
  useEffect(() => {
    if (data?.data) {
      const newGuests = data.data as Guest[];
      if (page === 1) {
        setAllGuests(newGuests);
      } else {
        setAllGuests(prev => {
          // Dedupe by id
          const existingIds = new Set(prev.map(g => g.id));
          const uniqueNew = newGuests.filter(g => !existingIds.has(g.id));
          return [...prev, ...uniqueNew];
        });
      }
      setHasMore(page < (data.pagination?.totalPages || 1));
    }
  }, [data, page]);

  // Infinite scroll intersection observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !isFetching) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, isFetching]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Fetch stats
  const { data: stats } = trpc.guests.stats.useQuery();

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    return {
      all: stats?.total || 0,
      arriving_today: stats?.arrivingToday || 0,
      arriving_tomorrow: stats?.arrivingTomorrow || 0,
      needs_attention: stats?.pending || 0,
    };
  }, [stats]);

  // Filter and sort guests client-side
  const filteredGuests = useMemo((): Guest[] => {
    if (allGuests.length === 0) return [];

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    // First filter
    let filtered: Guest[];
    switch (activeFilter) {
      case 'arriving_today':
        filtered = allGuests.filter((g) => g.arrivalDate === today);
        break;
      case 'arriving_tomorrow':
        filtered = allGuests.filter((g) => g.arrivalDate === tomorrow);
        break;
      case 'needs_attention':
        filtered = allGuests.filter((g) => g.registrationStatus === 'pending');
        break;
      default:
        filtered = [...allGuests];
    }

    // Then sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'arrivalDate':
          const dateA = a.arrivalDate || '9999-99-99';
          const dateB = b.arrivalDate || '9999-99-99';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'status':
          const statusA = a.registrationStatus || 'pending';
          const statusB = b.registrationStatus || 'pending';
          comparison = statusA.localeCompare(statusB);
          break;
        case 'group':
          const groupA = a.reportingLevel1 || 'zzz';
          const groupB = b.reportingLevel1 || 'zzz';
          comparison = groupA.localeCompare(groupB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allGuests, activeFilter, sortBy, sortDirection]);

  // Handle sort change
  const handleSortChange = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  // Handle card click
  const handleGuestClick = (guest: Guest) => {
    setSelectedGuest(guest);
    setSheetOpen(true);
  };

  // Handle filter change
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    // Reset is handled by useEffect watching activeFilter
  };

  // Format date for display
  const formatArrivalDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'MMM d');
    } catch {
      return dateStr;
    }
  };

  // Filter chips configuration
  const filters: { key: FilterType; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: 'all', label: 'All', count: filterCounts.all, icon: <Users className="h-3.5 w-3.5" /> },
    { key: 'arriving_today', label: 'Today', count: filterCounts.arriving_today, icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'arriving_tomorrow', label: 'Tomorrow', count: filterCounts.arriving_tomorrow, icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'needs_attention', label: 'Pending', count: filterCounts.needs_attention, icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header - Clean design matching flights page */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Title Row */}
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Guests</h1>
          <div className="flex items-center gap-2">
            {/* Sort Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  <span className="text-sm">Sort</span>
                  {sortDirection === 'asc' ? (
                    <SortAsc className="h-3.5 w-3.5 ml-1 text-slate-400" />
                  ) : (
                    <SortDesc className="h-3.5 w-3.5 ml-1 text-slate-400" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSortChange('name')} className="text-sm">
                  <span className="flex-1">Name</span>
                  {sortBy === 'name' && <Check className="h-4 w-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange('arrivalDate')} className="text-sm">
                  <span className="flex-1">Arrival Date</span>
                  {sortBy === 'arrivalDate' && <Check className="h-4 w-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange('status')} className="text-sm">
                  <span className="flex-1">Status</span>
                  {sortBy === 'status' && <Check className="h-4 w-4 text-emerald-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange('group')} className="text-sm">
                  <span className="flex-1">Group</span>
                  {sortBy === 'group' && <Check className="h-4 w-4 text-emerald-500" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/guests/import">
              <Button
                size="sm"
                className="h-8 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Import
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-slate-100 dark:bg-slate-700/50 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600"
            />
          </div>
        </div>

        {/* Filter Toggle - Pill design like flights direction toggle */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => handleFilterChange(filter.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeFilter === filter.key
                    ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {filter.icon}
                <span className="hidden xs:inline">{filter.label}</span>
                <span className={cn(
                  'text-xs tabular-nums',
                  activeFilter === filter.key
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="flex justify-center gap-4 px-4 py-2 text-sm border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{stats.confirmed}</span> confirmed
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              <span className="font-medium text-amber-600 dark:text-amber-400">{stats.pending}</span> pending
            </span>
            {stats.total > 0 && (
              <span className="text-slate-400 dark:text-slate-500">
                {stats.total} total
              </span>
            )}
          </div>
        )}
      </div>

      {/* Guest Cards */}
      <div className="px-4 py-4">
        {isLoading ? (
          // Loading skeletons - matching flight card skeleton design
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
                <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="h-1 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                  <div className="p-3 space-y-2">
                    {/* Header row skeleton */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                        <div className="space-y-1.5">
                          <div className="w-28 h-4 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                          <div className="w-20 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-6 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      </div>
                    </div>
                    {/* Footer row skeleton */}
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-600/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-5 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                        <div className="w-14 h-5 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                      </div>
                      <div className="w-16 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : filteredGuests.length === 0 ? (
          // Empty state
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              No guests found
            </p>
            {search && (
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your search terms
              </p>
            )}
          </div>
        ) : (
          // Guest cards - clean, minimal design matching flight cards
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredGuests.map((guest) => {
                const status = (guest.registrationStatus || 'pending') as string;
                const style = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
                const hasTransportNeeds = guest.needsArrivalTransfer || guest.needsDepartureTransfer;
                const initials = `${guest.firstName?.[0] || ''}${guest.lastName?.[0] || ''}`.toUpperCase();
                const fullName = `${guest.firstName} ${guest.lastName}`;

                return (
                  <motion.div
                    key={guest.id}
                    initial={false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    layout
                    layoutId={guest.id}
                  >
                    <div
                      className={cn(
                        'relative rounded-2xl overflow-hidden',
                        'border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer',
                        'border-slate-200 dark:border-slate-700',
                        'bg-white dark:bg-slate-800'
                      )}
                      onClick={() => handleGuestClick(guest)}
                    >
                      {/* Left accent bar - status color */}
                      <div className={cn('absolute left-0 top-0 bottom-0 w-1', style.accent)} />

                      {/* Main content */}
                      <div className="p-3 pl-4">
                        {/* Header row: Avatar + Name left, Status badge right */}
                        <div className="flex items-center justify-between gap-2">
                          {/* Left: Avatar + Name + Group */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar - clean circular design */}
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                              'bg-violet-50 dark:bg-violet-950/30'
                            )}>
                              <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                                {initials}
                              </span>
                            </div>

                            {/* Name and group */}
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                {fullName}
                              </h3>
                              {guest.reportingLevel1 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {guest.reportingLevel1}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Status badge */}
                          <Badge
                            className={cn(
                              'text-xs px-1.5 py-0 rounded-md border-0 capitalize font-medium shrink-0',
                              style.bg,
                              style.text
                            )}
                          >
                            {style.icon}
                            <span className="ml-1">{status}</span>
                          </Badge>
                        </div>

                        {/* Footer row: Travel info left, tap hint right */}
                        <div className={cn(
                          'mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50',
                          'flex items-center justify-between gap-2'
                        )}>
                          {/* Travel info pills */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Arrival date - sky blue like flight time */}
                            {guest.arrivalDate && (
                              <div className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                                'bg-sky-50 dark:bg-sky-950/30'
                              )}>
                                <Calendar className="h-3.5 w-3.5 text-sky-400 dark:text-sky-500" />
                                <span className="font-semibold text-xs text-sky-700 dark:text-sky-300">
                                  {formatArrivalDate(guest.arrivalDate)}
                                </span>
                              </div>
                            )}

                            {/* Flight number */}
                            {guest.arrivalFlightNumber && (
                              <div className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                                'bg-slate-50 dark:bg-slate-700/30'
                              )}>
                                <Plane className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 rotate-45" />
                                <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-300">
                                  {guest.arrivalFlightNumber}
                                </span>
                              </div>
                            )}

                            {/* Transport needs - violet like passenger count */}
                            {hasTransportNeeds && (
                              <div className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                                'bg-violet-50 dark:bg-violet-950/30'
                              )}>
                                <Bus className="h-3.5 w-3.5 text-violet-400 dark:text-violet-500" />
                                <span className="font-semibold text-xs text-violet-700 dark:text-violet-300">
                                  {guest.needsArrivalTransfer && guest.needsDepartureTransfer
                                    ? 'Both'
                                    : guest.needsArrivalTransfer
                                    ? 'Arr'
                                    : 'Dep'}
                                </span>
                              </div>
                            )}

                            {/* No travel info fallback */}
                            {!guest.arrivalDate && !guest.arrivalFlightNumber && !hasTransportNeeds && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                No travel info
                              </span>
                            )}
                          </div>

                          {/* Tap hint with chevron */}
                          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                            <span>Details</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Infinite scroll loader */}
      <div ref={loadMoreRef} className="px-4 py-6">
        {isFetching && !isLoading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading more guests...</span>
          </div>
        )}
        {!hasMore && filteredGuests.length > 0 && (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500">
            All {filteredGuests.length} guests loaded
          </div>
        )}
      </div>

      {/* Guest Detail Sheet */}
      <GuestDetailSheet
        guest={selectedGuest}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            refetch();
          }
        }}
        onUpdate={() => refetch()}
      />
    </div>
  );
}
