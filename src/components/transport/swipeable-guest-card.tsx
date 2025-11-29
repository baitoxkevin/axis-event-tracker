'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plane, Clock, User, Check, X, Bus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableGuestCardProps {
  guest: {
    id: string;
    name: string;
    flightNumber?: string | null;
    time?: string | null;
    status?: string | null;
    travelType?: string | null;
  };
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onSwipeRight?: () => void; // Assign action
  onSwipeLeft?: () => void; // Unassign/reject action
  swipeRightLabel?: string;
  swipeLeftLabel?: string;
  showCheckbox?: boolean;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 100;

export function SwipeableGuestCard({
  guest,
  isSelected,
  onSelect,
  onSwipeRight,
  onSwipeLeft,
  swipeRightLabel = 'Assign',
  swipeLeftLabel = 'Skip',
  showCheckbox = true,
  disabled = false,
}: SwipeableGuestCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);

  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    ['rgb(239, 68, 68)', 'rgb(255, 255, 255)', 'rgb(34, 197, 94)']
  );
  const rightOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setIsDragging(false);

    if (disabled) return;

    if (info.offset.x > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg" ref={constraintsRef}>
      {/* Background indicators */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4"
        style={{ opacity: rightOpacity }}
      >
        <div className="flex items-center gap-2 text-white font-medium">
          <Bus className="h-5 w-5" />
          {swipeRightLabel}
        </div>
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center pl-4"
        style={{ opacity: leftOpacity }}
      >
        <div className="flex items-center gap-2 text-white font-medium">
          <X className="h-5 w-5" />
          {swipeLeftLabel}
        </div>
      </motion.div>

      {/* Card content */}
      <motion.div
        className={cn(
          'relative flex items-center gap-3 rounded-lg border bg-white p-3 touch-pan-y',
          isSelected && 'ring-2 ring-primary ring-offset-1',
          isDragging && 'shadow-lg',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ x, background: isDragging ? background : undefined }}
        drag={!disabled && (onSwipeRight || onSwipeLeft) ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
      >
        {showCheckbox && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(!!checked)}
            disabled={disabled}
            className="flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium truncate">{guest.name}</span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {guest.flightNumber && (
              <span className="flex items-center gap-1">
                <Plane className="h-3 w-3" />
                {guest.flightNumber}
              </span>
            )}
            {guest.time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {guest.time}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {guest.status && guest.status !== 'scheduled' && (
            <Badge
              variant={
                guest.status === 'landed'
                  ? 'default'
                  : guest.status === 'cancelled'
                    ? 'destructive'
                    : 'secondary'
              }
              className="text-xs"
            >
              {guest.status}
            </Badge>
          )}
          {guest.travelType && (
            <Badge variant="outline" className="text-xs">
              {guest.travelType}
            </Badge>
          )}
        </div>

        {/* Visual swipe hint for mobile */}
        {!disabled && (onSwipeRight || onSwipeLeft) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hidden sm:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// List component with bulk selection support
interface SwipeableGuestListProps {
  guests: Array<{
    id: string;
    name: string;
    flightNumber?: string | null;
    time?: string | null;
    status?: string | null;
    travelType?: string | null;
  }>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onAssign?: (guestId: string) => void;
  onSkip?: (guestId: string) => void;
}

export function SwipeableGuestList({
  guests,
  selectedIds,
  onSelectionChange,
  onAssign,
  onSkip,
}: SwipeableGuestListProps) {
  const allSelected = guests.length > 0 && guests.every(g => selectedIds.has(g.id));
  const someSelected = guests.some(g => selectedIds.has(g.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(guests.map(g => g.id)));
    }
  };

  const toggleGuest = (guestId: string, selected: boolean) => {
    const newSet = new Set(selectedIds);
    if (selected) {
      newSet.add(guestId);
    } else {
      newSet.delete(guestId);
    }
    onSelectionChange(newSet);
  };

  return (
    <div className="space-y-2">
      {/* Select all header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          className={cn(someSelected && !allSelected && 'opacity-50')}
        />
        <span className="text-sm font-medium">
          {selectedIds.size > 0
            ? `${selectedIds.size} of ${guests.length} selected`
            : `Select all (${guests.length})`}
        </span>
      </div>

      {/* Guest cards */}
      <div className="space-y-2">
        {guests.map((guest) => (
          <SwipeableGuestCard
            key={guest.id}
            guest={guest}
            isSelected={selectedIds.has(guest.id)}
            onSelect={(selected) => toggleGuest(guest.id, selected)}
            onSwipeRight={onAssign ? () => onAssign(guest.id) : undefined}
            onSwipeLeft={onSkip ? () => onSkip(guest.id) : undefined}
          />
        ))}
      </div>

      {guests.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p>No unassigned guests</p>
        </div>
      )}
    </div>
  );
}
