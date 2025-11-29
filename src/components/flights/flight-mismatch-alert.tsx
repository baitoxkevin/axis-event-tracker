'use client';

import { AlertTriangle, Clock, Plane, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface FlightMismatch {
  id: string;
  firstName: string;
  lastName: string;
  flightNumber: string | null;
  flightDate: string | null;
  enteredTime: string | null;
  verifiedTime: string | null;
  terminal: string | null;
  direction: 'arrival' | 'departure';
}

interface FlightMismatchAlertProps {
  mismatches: FlightMismatch[];
  onDismiss?: () => void;
}

export function FlightMismatchAlert({ mismatches, onDismiss }: FlightMismatchAlertProps) {
  if (mismatches.length === 0) {
    return null;
  }

  // Group by flight number
  const flightGroups = mismatches.reduce((acc, mismatch) => {
    const key = mismatch.flightNumber || 'unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(mismatch);
    return acc;
  }, {} as Record<string, FlightMismatch[]>);

  return (
    <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-900 font-semibold">
        Flight Time Discrepancies Detected
      </AlertTitle>
      <AlertDescription className="mt-3">
        <p className="text-sm text-amber-800 mb-3">
          The following flights have verified arrival times that differ from the imported data.
          Transport schedules may need to be adjusted.
        </p>

        <div className="space-y-3">
          {Object.entries(flightGroups).map(([flightNumber, guests]) => {
            const firstGuest = guests[0];
            return (
              <div
                key={flightNumber}
                className="p-3 rounded-lg bg-white/80 border border-amber-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold">{flightNumber}</span>
                    <Badge variant="outline" className="text-xs">
                      {firstGuest.direction === 'arrival' ? 'Arriving' : 'Departing'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {firstGuest.flightDate}
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="line-through text-amber-600">{firstGuest.enteredTime}</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-green-600" />
                    <span className="font-semibold text-green-700">{firstGuest.verifiedTime}</span>
                  </div>
                  {firstGuest.terminal && (
                    <Badge variant="secondary" className="text-xs">
                      Terminal {firstGuest.terminal}
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{guests.length} guest{guests.length > 1 ? 's' : ''}:</span>{' '}
                  {guests.map(g => `${g.firstName} ${g.lastName}`).join(', ')}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {/* Generate links for each unique flight with mismatch */}
          {Object.entries(flightGroups).slice(0, 2).map(([flightNumber]) => (
            <Button key={flightNumber} asChild size="sm" variant="outline" className="bg-white">
              <Link href={`/transport?flight=${encodeURIComponent(flightNumber)}&highlight=true`}>
                Review {flightNumber}
              </Link>
            </Button>
          ))}
          {Object.keys(flightGroups).length > 2 && (
            <Button asChild size="sm" variant="outline" className="bg-white">
              <Link href="/transport?mismatch=true">
                Review All ({Object.keys(flightGroups).length})
              </Link>
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
