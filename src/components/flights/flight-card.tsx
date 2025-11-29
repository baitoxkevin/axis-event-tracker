'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Plane,
  Clock,
  Users,
  Star,
  X,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FlightData {
  flightNumber: string;
  scheduledTime: string | null;
  verifiedTime: string | null;
  terminal: string | null;
  status: string | null;
  hasTimeMismatch: boolean;
  guests: Array<{ id: string; name: string; enteredTime: string | null }>;
  remarks?: string;
}

interface FlightCardProps {
  flight: FlightData;
  isPinned: boolean;
  onPin: () => void;
  onDismiss: () => void;
  onClick: () => void;
  direction: 'arrival' | 'departure';
}

const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 500;

// Status to clean, minimal color mapping
const statusStyles: Record<string, {
  accent: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
  badgeBg: string;
}> = {
  scheduled: {
    accent: 'bg-emerald-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  active: {
    accent: 'bg-sky-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <Plane className="h-3.5 w-3.5" />,
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  landed: {
    accent: 'bg-teal-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeBg: 'bg-teal-50 dark:bg-teal-950/40',
  },
  delayed: {
    accent: 'bg-amber-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <Clock className="h-3.5 w-3.5" />,
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  cancelled: {
    accent: 'bg-rose-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <X className="h-3.5 w-3.5" />,
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
  },
  diverted: {
    accent: 'bg-purple-500',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  unknown: {
    accent: 'bg-slate-400',
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: <Clock className="h-3.5 w-3.5" />,
    badgeBg: 'bg-slate-50 dark:bg-slate-800/40',
  },
};

export function FlightCard({
  flight,
  isPinned,
  onPin,
  onDismiss,
  onClick,
  direction,
}: FlightCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartTime = useRef(0);
  const hasMoved = useRef(false);

  const x = useMotionValue(0);

  // Background colors for swipe feedback - smoother gradients
  const backgroundLeft = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD * 0.5, 0],
    ['rgb(234, 179, 8)', 'rgba(234, 179, 8, 0.4)', 'rgba(255, 255, 255, 0)']
  );
  const backgroundRight = useTransform(
    x,
    [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD * 1.5],
    ['rgba(255, 255, 255, 0)', 'rgba(239, 68, 68, 0.4)', 'rgb(239, 68, 68)']
  );

  // Opacity for action indicators - smoother transitions
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.3, 0], [1, 0.6, 0]);
  const rightOpacity = useTransform(x, [0, SWIPE_THRESHOLD * 0.3, SWIPE_THRESHOLD], [0, 0.6, 1]);

  // Scale for action icons based on swipe progress
  const leftScale = useTransform(x, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0], [1.1, 0.9, 0.8]);
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD], [0.8, 0.9, 1.1]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStartTime.current = Date.now();
  }, []);

  const handleDrag = useCallback(() => {
    hasMoved.current = true;
  }, []);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const dragDuration = Date.now() - dragStartTime.current;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Quick flick detection (fast swipe even if short distance)
    const isQuickFlick = Math.abs(velocity) > VELOCITY_THRESHOLD && dragDuration < 300;

    // Determine action based on offset OR velocity
    const shouldPinByOffset = offset < -SWIPE_THRESHOLD;
    const shouldDismissByOffset = offset > SWIPE_THRESHOLD;
    const shouldPinByVelocity = isQuickFlick && velocity < -VELOCITY_THRESHOLD;
    const shouldDismissByVelocity = isQuickFlick && velocity > VELOCITY_THRESHOLD;

    if (shouldPinByOffset || shouldPinByVelocity) {
      // Swipe LEFT - Pin the card
      setIsAnimating(true);
      animate(x, 0, {
        type: 'spring',
        stiffness: 400,
        damping: 35,
        onComplete: () => setIsAnimating(false)
      });
      onPin();
    } else if (shouldDismissByOffset || shouldDismissByVelocity) {
      // Swipe RIGHT - Dismiss the card with slide out animation
      setIsAnimating(true);
      animate(x, 400, {
        type: 'spring',
        stiffness: 400,
        damping: 40,
        onComplete: () => {
          setIsAnimating(false);
          onDismiss();
        }
      });
    } else {
      // Reset position with smooth spring
      animate(x, 0, {
        type: 'spring',
        stiffness: 500,
        damping: 35
      });
    }

    // Reset dragging state after animation frame
    requestAnimationFrame(() => {
      setIsDragging(false);
    });
  }, [x, onPin, onDismiss]);

  const handleClick = useCallback(() => {
    // Only trigger click if not dragging and no significant movement
    if (!isDragging && !isAnimating && !hasMoved.current) {
      onClick();
    }
  }, [isDragging, isAnimating, onClick]);

  const status = flight.status?.toLowerCase() || 'unknown';
  const style = statusStyles[status] || statusStyles.unknown;
  const displayTime = flight.verifiedTime || flight.scheduledTime;
  const passengerCount = flight.guests.length;

  return (
    <div className="relative overflow-hidden rounded-2xl" ref={containerRef}>
      {/* Background action indicators */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-6"
        style={{ backgroundColor: backgroundLeft, opacity: leftOpacity }}
      >
        <motion.div
          className="flex items-center gap-2 text-white font-semibold"
          style={{ scale: leftScale }}
        >
          <Star className="h-5 w-5" />
          <span>Pin</span>
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6"
        style={{ backgroundColor: backgroundRight, opacity: rightOpacity }}
      >
        <motion.div
          className="flex items-center gap-2 text-white font-semibold"
          style={{ scale: rightScale }}
        >
          <span>Dismiss</span>
          <X className="h-5 w-5" />
        </motion.div>
      </motion.div>

      {/* Card content - Clean minimal design */}
      <motion.div
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'border shadow-sm hover:shadow-lg transition-shadow duration-200 cursor-pointer',
          'select-none',
          isPinned && 'ring-2 ring-amber-400 ring-offset-2',
          style.border,
          style.bg
        )}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -150, right: 150 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        whileTap={{ scale: isDragging ? 1 : 0.98 }}
      >
        {/* Left accent bar */}
        <div className={cn('absolute left-0 top-0 bottom-0 w-1', style.accent)} />

        {/* Main content */}
        <div className="p-3 pl-4">
          {/* Header row: Flight info left, Time + Passengers right */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Icon + Flight number + Status - compact inline */}
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Direction icon - smaller */}
              <div className={cn(
                'p-1.5 rounded-lg shrink-0',
                direction === 'arrival'
                  ? 'bg-sky-50 dark:bg-sky-950/30'
                  : 'bg-orange-50 dark:bg-orange-950/30'
              )}>
                <Plane className={cn(
                  'h-4 w-4',
                  direction === 'arrival'
                    ? 'text-sky-500 dark:text-sky-400 rotate-45'
                    : 'text-orange-500 dark:text-orange-400 -rotate-45'
                )} />
              </div>

              {/* Flight number */}
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight shrink-0">
                {flight.flightNumber}
              </h3>

              {/* Status badge - inline with flight number */}
              <Badge
                className={cn(
                  'text-xs px-1.5 py-0 rounded-md border-0 capitalize font-medium shrink-0',
                  style.badgeBg,
                  style.text
                )}
              >
                {style.icon}
                <span className="ml-1">{status}</span>
              </Badge>

              {/* Pinned star - inline */}
              {isPinned && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
              )}
            </div>

            {/* Right: Time + Passenger count */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Time display - sky blue tint */}
              {displayTime && (
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                  flight.hasTimeMismatch
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-sky-50 dark:bg-sky-950/30'
                )}>
                  <Clock className={cn(
                    'h-3.5 w-3.5',
                    flight.hasTimeMismatch
                      ? 'text-amber-500'
                      : 'text-sky-400 dark:text-sky-500'
                  )} />
                  <span className={cn(
                    'font-mono text-sm font-semibold',
                    flight.hasTimeMismatch
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-sky-700 dark:text-sky-300'
                  )}>
                    {displayTime}
                  </span>
                  {flight.hasTimeMismatch && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                </div>
              )}

              {/* Passenger count - violet/purple tint, fixed width for 2 digits */}
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                'bg-violet-50 dark:bg-violet-950/30'
              )}>
                <Users className="h-3.5 w-3.5 text-violet-400 dark:text-violet-500" />
                <span className="font-semibold text-sm text-violet-700 dark:text-violet-300 min-w-[1.25rem] text-right tabular-nums">
                  {passengerCount}
                </span>
              </div>
            </div>
          </div>

          {/* Guest preview or empty state */}
          <div className={cn(
            'mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50',
            'flex items-center justify-between gap-2'
          )}>
            {passengerCount > 0 ? (
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
                {flight.guests.slice(0, 2).map((g, i) => (
                  <span key={g.id}>
                    {g.name}
                    {i < Math.min(flight.guests.length, 2) - 1 && ', '}
                  </span>
                ))}
                {passengerCount > 2 && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {' '}+{passengerCount - 2} more
                  </span>
                )}
              </span>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                No passengers
              </span>
            )}

            {/* Remarks indicator - inline if present, otherwise tap hint */}
            {flight.remarks ? (
              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                <MessageSquare className="h-3 w-3" />
                <span>Note</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                Tap for details
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Loading skeleton for flight card with shimmer animation
export function FlightCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
      <div className="p-3 space-y-2">
        {/* Header row skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
            <div className="w-16 h-5 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
            <div className="w-14 h-4 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
            <div className="w-10 h-6 rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
          </div>
        </div>
        {/* Footer row skeleton */}
        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-600/50 flex items-center justify-between">
          <div className="w-32 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
          <div className="w-16 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-shimmer bg-[length:200%_100%]" />
        </div>
      </div>
    </div>
  );
}
