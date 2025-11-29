'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plane,
  Clock,
  Users,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  User,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { FlightData } from './flight-card';

interface PassengerSheetProps {
  flight: FlightData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: 'arrival' | 'departure';
}

// Status styling
const statusStyles: Record<string, {
  gradient: string;
  bg: string;
  text: string;
  lightBg: string;
}> = {
  scheduled: {
    gradient: 'from-emerald-500 to-green-600',
    bg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  active: {
    gradient: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-400',
    lightBg: 'bg-sky-50 dark:bg-sky-950/30',
  },
  landed: {
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  delayed: {
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  cancelled: {
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    lightBg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  diverted: {
    gradient: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-400',
    lightBg: 'bg-purple-50 dark:bg-purple-950/30',
  },
  unknown: {
    gradient: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-500',
    text: 'text-slate-700 dark:text-slate-400',
    lightBg: 'bg-slate-50 dark:bg-slate-950/30',
  },
};

export function PassengerSheet({
  flight,
  open,
  onOpenChange,
  direction,
}: PassengerSheetProps) {
  if (!flight) return null;

  const status = flight.status?.toLowerCase() || 'unknown';
  const style = statusStyles[status] || statusStyles.unknown;
  const displayTime = flight.verifiedTime || flight.scheduledTime;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl px-0 border-0 bg-slate-50 dark:bg-slate-900"
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header with gradient background */}
        <div className="relative overflow-hidden">
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br opacity-10',
            style.gradient
          )} />
          <SheetHeader className="px-5 pb-5 relative">
            <div className="flex items-start gap-4">
              {/* Flight icon with gradient ring */}
              <div className={cn(
                'relative flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br p-[2px] shadow-lg',
                style.gradient
              )}>
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center">
                  <Plane className={cn(
                    'h-7 w-7',
                    style.text,
                    direction === 'arrival' ? 'rotate-45' : '-rotate-45'
                  )} />
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <SheetTitle className="text-left text-2xl font-bold text-slate-900 dark:text-white">
                  {flight.flightNumber}
                </SheetTitle>
                <SheetDescription className="text-left flex items-center gap-3 mt-1.5 text-slate-500 dark:text-slate-400">
                  {displayTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {displayTime}
                    </span>
                  )}
                  {flight.terminal && (
                    <span className="flex items-center gap-1.5">
                      <Terminal className="h-4 w-4" />
                      Terminal {flight.terminal}
                    </span>
                  )}
                </SheetDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    className={cn(
                      'capitalize font-medium text-xs px-2.5 py-0.5 rounded-full border-0',
                      style.lightBg, style.text
                    )}
                  >
                    {status}
                  </Badge>
                  <Badge
                    className={cn(
                      'font-medium text-xs px-2.5 py-0.5 rounded-full border-0',
                      direction === 'arrival'
                        ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400'
                        : 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400'
                    )}
                  >
                    {direction === 'arrival' ? 'Arriving' : 'Departing'}
                  </Badge>
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Time mismatch warning */}
        {flight.hasTimeMismatch && (
          <div className="mx-5 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                  Import Time vs Actual Flight Time
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Some passengers have imported times that differ from verified flight schedule
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Passenger count summary */}
        <div className="px-5 mb-4">
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700">
                <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Passengers</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {flight.guests.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Passenger list */}
        <div className="px-5 mb-4">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Passenger List
          </h4>
        </div>

        <ScrollArea className="flex-1 h-[calc(85vh-340px)]">
          <div className="px-5 space-y-2 pb-6">
            {flight.guests.map((guest, index) => {
              const enteredTime = guest.enteredTime;
              const verifiedTime = flight.verifiedTime || flight.scheduledTime;
              const hasMismatch = enteredTime && verifiedTime && enteredTime !== verifiedTime;

              return (
                <Link
                  key={guest.id}
                  href={`/guests/${guest.id}`}
                  className="block"
                >
                  <div className={cn(
                    'bg-white dark:bg-slate-800/80 rounded-xl p-4',
                    'border shadow-sm hover:shadow-md transition-all',
                    'hover:scale-[1.01] active:scale-[0.99]',
                    hasMismatch
                      ? 'border-amber-200 dark:border-amber-800/50'
                      : 'border-slate-200/50 dark:border-slate-700/50'
                  )}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                        hasMismatch
                          ? 'bg-amber-100 dark:bg-amber-900/50'
                          : 'bg-slate-100 dark:bg-slate-700'
                      )}>
                        <User className={cn(
                          'h-5 w-5',
                          hasMismatch
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-400'
                        )} />
                      </div>

                      {/* Name and time info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {guest.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {enteredTime && (
                            <span className={cn(
                              'text-xs flex items-center gap-1',
                              hasMismatch
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                            )}>
                              <Clock className="h-3 w-3" />
                              Imported: {enteredTime}
                              {hasMismatch && (
                                <AlertTriangle className="h-3 w-3 ml-1" />
                              )}
                            </span>
                          )}
                          {hasMismatch && verifiedTime && (
                            <span className="text-xs flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified: {verifiedTime}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    </div>

                    {/* Mismatch warning */}
                    {hasMismatch && (
                      <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Excel import time differs from actual flight schedule</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            {flight.guests.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No passengers on this flight</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/80">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl h-12"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
