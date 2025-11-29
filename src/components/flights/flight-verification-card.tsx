'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlightStatusBadge } from './flight-status-badge';
import {
  Plane,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

interface FlightVerificationCardProps {
  guestId: string;
  guestName: string;
  direction: 'arrival' | 'departure';
  flightNumber: string | null;
  flightDate: string | null;
  enteredTime: string | null;
  verifiedTime?: string | null;
  terminal?: string | null;
  gate?: string | null;
  status?: string | null;
  hasTimeMismatch?: boolean;
  onVerified?: () => void;
}

export function FlightVerificationCard({
  guestId,
  guestName,
  direction,
  flightNumber,
  flightDate,
  enteredTime,
  verifiedTime,
  terminal,
  gate,
  status,
  hasTimeMismatch,
  onVerified,
}: FlightVerificationCardProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    flightInfo?: {
      terminal: string | null;
      gate: string | null;
      scheduledTime: string | null;
      status: string;
      timeMismatch: boolean;
      timeDifference: string | null;
    };
    error?: string;
  } | null>(null);

  const verifyMutation = trpc.flights.verifyGuestFlight.useMutation({
    onSuccess: (data) => {
      if (data.success && 'flightInfo' in data && data.flightInfo) {
        setVerificationResult({
          success: true,
          flightInfo: {
            terminal: data.flightInfo.terminal,
            gate: data.flightInfo.gate,
            scheduledTime: data.flightInfo.scheduledTime,
            status: data.flightInfo.status,
            timeMismatch: data.flightInfo.timeMismatch,
            timeDifference: data.flightInfo.timeDifference,
          },
        });
      } else {
        setVerificationResult({
          success: false,
          error: 'error' in data ? data.error : 'Verification failed',
        });
      }
      setIsVerifying(false);
      onVerified?.();
    },
    onError: (error) => {
      setVerificationResult({
        success: false,
        error: error.message,
      });
      setIsVerifying(false);
    },
  });

  const handleVerify = () => {
    setIsVerifying(true);
    verifyMutation.mutate({ guestId, direction });
  };

  if (!flightNumber) {
    return null;
  }

  const displayTerminal = verificationResult?.flightInfo?.terminal || terminal;
  const displayGate = verificationResult?.flightInfo?.gate || gate;
  const displayStatus = verificationResult?.flightInfo?.status || status;
  const displayMismatch = verificationResult?.flightInfo?.timeMismatch ?? hasTimeMismatch;
  const displayVerifiedTime = verificationResult?.flightInfo?.scheduledTime || verifiedTime;
  const timeDiff = verificationResult?.flightInfo?.timeDifference;

  return (
    <Card className={cn(
      'transition-all',
      displayMismatch && 'border-amber-300 bg-amber-50/50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plane className={cn(
              'h-4 w-4',
              direction === 'arrival' ? 'rotate-45' : '-rotate-45'
            )} />
            {direction === 'arrival' ? 'Arrival' : 'Departure'} Flight
          </CardTitle>
          {displayStatus && (
            <FlightStatusBadge status={displayStatus as 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown'} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Flight Info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">{flightNumber}</p>
            <p className="text-xs text-muted-foreground">{flightDate}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Guest</p>
            <p className="text-sm font-medium">{guestName}</p>
          </div>
        </div>

        {/* Time Comparison */}
        <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Entered Time
            </p>
            <p className={cn(
              'text-lg font-mono',
              displayMismatch && 'text-amber-600 line-through'
            )}>
              {enteredTime || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified Time
            </p>
            <p className={cn(
              'text-lg font-mono',
              displayMismatch && 'text-green-600 font-bold'
            )}>
              {displayVerifiedTime || '-'}
            </p>
          </div>
        </div>

        {/* Mismatch Warning */}
        {displayMismatch && timeDiff && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-100 text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              <strong>Time mismatch:</strong> Actual flight time differs by {timeDiff}
            </p>
          </div>
        )}

        {/* Terminal & Gate */}
        {(displayTerminal || displayGate) && (
          <div className="flex items-center gap-4 text-sm">
            {displayTerminal && (
              <div className="flex items-center gap-1">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span>Terminal {displayTerminal}</span>
              </div>
            )}
            {displayGate && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Gate {displayGate}</span>
              </div>
            )}
          </div>
        )}

        {/* Verification Error */}
        {verificationResult?.error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-100 text-red-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{verificationResult.error}</p>
          </div>
        )}

        {/* Verify Button */}
        <Button
          variant={displayVerifiedTime ? 'outline' : 'default'}
          size="sm"
          className="w-full"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : displayVerifiedTime ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-verify Flight
            </>
          ) : (
            <>
              <Plane className="mr-2 h-4 w-4" />
              Verify Flight Status
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
