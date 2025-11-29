'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlightMismatchAlert } from '@/components/flights';
import { trpc } from '@/lib/trpc/client';
import {
  Users,
  Plane,
  Bus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Upload,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.4, 0.25, 1] as const,
    },
  }),
};

export default function DashboardPage() {
  const [showMismatchAlert, setShowMismatchAlert] = useState(true);
  const { data: guestStats, isLoading: guestLoading } = trpc.guests.stats.useQuery();
  const { data: transportStats, isLoading: transportLoading } = trpc.transport.dashboard.stats.useQuery();
  const { data: flightMismatches, isLoading: mismatchLoading } = trpc.flights.getMismatches.useQuery({ direction: 'both' });

  const isLoading = guestLoading || transportLoading;

  // Calculate pending transport
  const arrivalPending = (transportStats?.arrivalNeedingTransfer || 0) - (transportStats?.arrivalAssigned || 0);
  const departurePending = (transportStats?.departureNeedingTransfer || 0) - (transportStats?.departureAssigned || 0);
  const totalPendingTransport = Math.max(0, arrivalPending) + Math.max(0, departurePending);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Event overview at a glance
            </p>
          </div>
          <Link href="/guests/import">
            <Button
              size="sm"
              className="bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-slate-100/10"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Import
            </Button>
          </Link>
        </div>
      </div>

      {/* Flight Mismatch Alert */}
      {showMismatchAlert && flightMismatches && flightMismatches.length > 0 && (
        <div className="px-4 mb-4">
          <FlightMismatchAlert
            mismatches={flightMismatches}
            onDismiss={() => setShowMismatchAlert(false)}
          />
        </div>
      )}

      {/* Bento Grid - 2x2 - Minimalist Design */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {/* Card 1: Total Guests (Top Left) */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Link href="/guests">
            <Card className="h-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
              <CardContent className="p-4 relative">
                {/* Subtle accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                      <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>

                  {isLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {guestStats?.total || 0}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Total Guests
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {guestStats?.confirmed || 0} confirmed
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {guestStats?.pending || 0} pending
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Card 2: Arrivals Today (Top Right) */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Link href="/flights">
            <Card className="h-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
              <CardContent className="p-4 relative">
                {/* Subtle accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/30">
                      <Plane className="h-5 w-5 text-sky-600 dark:text-sky-400 rotate-45" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>

                  {isLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {guestStats?.arrivingToday || 0}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Arriving Today
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3 w-3" />
                        +{guestStats?.arrivingTomorrow || 0} tomorrow
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Card 3: Transport Status (Bottom Left) */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Link href="/transport">
            <Card className="h-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
              <CardContent className="p-4 relative">
                {/* Subtle accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Bus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>

                  {isLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {transportStats?.arrivalAssigned || 0}
                        <span className="text-lg text-slate-400">/{transportStats?.arrivalNeedingTransfer || 0}</span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Transport Assigned
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <ArrowDownToLine className="h-3 w-3" />
                          Arrivals
                        </div>
                        {totalPendingTransport > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {totalPendingTransport} pending
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Card 4: Today's Schedules (Bottom Right) */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Link href="/transport">
            <Card className="h-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
              <CardContent className="p-4 relative">
                {/* Subtle accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>

                  {isLoading ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {transportStats?.todaySchedules || 0}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Today&apos;s Trips
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <TrendingUp className="h-3 w-3" />
                        Active schedules
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      {/* Quick Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="px-4 mt-6"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="space-y-3">
          {/* Pending Transport Alert */}
          {totalPendingTransport > 0 && (
            <Link href="/transport">
              <Card className="border-0 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {totalPendingTransport} guests need transport
                      </p>
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Assign them to available schedules
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* All Good State */}
          {totalPendingTransport === 0 && !isLoading && (
            <Card className="border-0 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                      All transport assigned!
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      All guests have been assigned to schedules
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Link href="/guests">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex-col items-center gap-1 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Users className="h-5 w-5 text-violet-500" />
                <span className="text-xs font-medium">Guests</span>
              </Button>
            </Link>
            <Link href="/flights">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex-col items-center gap-1 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plane className="h-5 w-5 text-sky-500" />
                <span className="text-xs font-medium">Flights</span>
              </Button>
            </Link>
            <Link href="/transport">
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex-col items-center gap-1 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bus className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-medium">Transport</span>
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
