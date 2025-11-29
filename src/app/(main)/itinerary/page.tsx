'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Coffee,
  Utensils,
  Presentation,
  PartyPopper,
  Construction,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Placeholder schedule data
const scheduleItems = [
  {
    time: '08:00',
    title: 'Registration & Breakfast',
    location: 'Main Lobby',
    icon: Coffee,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    time: '09:30',
    title: 'Opening Keynote',
    location: 'Grand Ballroom',
    icon: Presentation,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    time: '12:00',
    title: 'Networking Lunch',
    location: 'Terrace Restaurant',
    icon: Utensils,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    time: '14:00',
    title: 'Breakout Sessions',
    location: 'Conference Rooms',
    icon: Users,
    gradient: 'from-sky-500 to-blue-600',
  },
  {
    time: '18:00',
    title: 'Gala Dinner',
    location: 'Rooftop Garden',
    icon: PartyPopper,
    gradient: 'from-rose-500 to-pink-600',
  },
];

const cardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.25, 0.4, 0.25, 1] as const,
    },
  }),
};

export default function ItineraryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Itinerary
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Event schedule & agenda
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays className="h-4 w-4" />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 mb-6"
      >
        <Card className="border-0 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                <Construction className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-indigo-800 dark:text-indigo-300">
                  Feature Coming Soon
                </p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">
                  Full itinerary management will be available in the next update
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Schedule Preview */}
      <div className="px-4">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Sample Schedule
        </h2>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-3">
            {scheduleItems.map((item, index) => (
              <motion.div
                key={item.title}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={cn(
                    'relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg',
                    item.gradient
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>

                  {/* Card */}
                  <Card className="flex-1 border-0 bg-white dark:bg-slate-800/80 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                              {item.time}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                              <MapPin className="h-3.5 w-3.5" />
                              {item.location}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="px-4 mt-8 text-center"
      >
        <p className="text-sm text-slate-400 dark:text-slate-500">
          This is a preview. Real event schedule will sync from your event data.
        </p>
      </motion.div>
    </div>
  );
}
