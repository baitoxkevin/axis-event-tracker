'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Calendar,
  Plane,
  Users,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportDiff, FieldChange, Guest } from '@/types';

// Alert types for import analysis
type ImportAlert = {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  count?: number;
  items?: string[];
};

interface DiffViewerProps {
  diff: ImportDiff;
  onApprove: (options: { removeDeleted: boolean }) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  axisEmail: 'Axis Email',
  reportingLevel1: 'Reporting Level 1',
  reportingLevel2: 'Reporting Level 2',
  reportingLevel3: 'Reporting Level 3',
  function: 'Function',
  location: 'Location',
  arrivalDate: 'Arrival Date',
  arrivalTime: 'Arrival Time',
  arrivalFlightNumber: 'Arrival Flight',
  arrivalAirport: 'Arrival Airport',
  arrivalFlightRoute: 'Arrival Route',
  departureDate: 'Departure Date',
  departureTime: 'Departure Time',
  departureFlightNumber: 'Departure Flight',
  departureAirport: 'Departure Airport',
  departureFlightRoute: 'Departure Route',
  hotelCheckinDate: 'Hotel Check-in',
  hotelCheckoutDate: 'Hotel Check-out',
  extendStayBefore: 'Extend Before',
  extendStayAfter: 'Extend After',
  earlyCheckin: 'Early Check-in',
  lateCheckout: 'Late Check-out',
  needsArrivalTransfer: 'Arrival Transfer',
  needsDepartureTransfer: 'Departure Transfer',
  registrationStatus: 'Status',
  travelType: 'Travel Type',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function ChangeItem({ change }: { change: FieldChange }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-muted-foreground">
        {FIELD_LABELS[change.field] || change.field}:
      </span>
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800 line-through">
        {formatValue(change.oldValue)}
      </span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">
        {formatValue(change.newValue)}
      </span>
    </div>
  );
}

function ModifiedGuestRow({
  guest,
  changes,
}: {
  guest: Guest;
  changes: FieldChange[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-amber-50">
          <TableCell>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </TableCell>
          <TableCell>
            <div>
              <span className="font-medium">
                {guest.firstName} {guest.lastName}
              </span>
              <p className="text-sm text-muted-foreground">{guest.email}</p>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="bg-amber-100 text-amber-800">
              {changes.length} change{changes.length !== 1 ? 's' : ''}
            </Badge>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow className="bg-amber-50/50">
          <TableCell colSpan={3} className="p-4">
            <div className="space-y-2">
              {changes.map((change, i) => (
                <ChangeItem key={i} change={change} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AddedGuestRow({ guest }: { guest: Partial<Guest> }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-green-50">
          <TableCell>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </TableCell>
          <TableCell>
            <div>
              <span className="font-medium">
                {guest.firstName} {guest.lastName}
              </span>
              <p className="text-sm text-muted-foreground">{guest.email}</p>
            </div>
          </TableCell>
          <TableCell>
            <Badge className="bg-green-100 text-green-800">New</Badge>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow className="bg-green-50/50">
          <TableCell colSpan={3} className="p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(guest)
                .filter(
                  ([key, value]) =>
                    value !== null &&
                    value !== undefined &&
                    key !== 'id' &&
                    key !== 'createdAt' &&
                    key !== 'updatedAt'
                )
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-muted-foreground">
                      {FIELD_LABELS[key] || key}:
                    </span>
                    <span>{formatValue(value)}</span>
                  </div>
                ))}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RemovedGuestRow({ guest }: { guest: Guest & { first_name?: string; last_name?: string } }) {
  // Handle both camelCase and snake_case field names from database
  const firstName = guest.firstName || guest.first_name || '';
  const lastName = guest.lastName || guest.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';

  return (
    <TableRow className="bg-red-50/50">
      <TableCell>
        <Trash2 className="h-4 w-4 text-red-500" />
      </TableCell>
      <TableCell>
        <div>
          <span className="font-medium">
            {fullName}
          </span>
          <p className="text-sm text-muted-foreground">{guest.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="destructive">Not in import</Badge>
      </TableCell>
    </TableRow>
  );
}

function ErrorRow({ row, errors }: { row: number; errors: string[] }) {
  return (
    <TableRow className="bg-red-50">
      <TableCell>
        <AlertCircle className="h-4 w-4 text-red-500" />
      </TableCell>
      <TableCell>Row {row}</TableCell>
      <TableCell>
        <div className="space-y-1">
          {errors.map((error, i) => (
            <p key={i} className="text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Function to analyze import data for alerts and anomalies
function analyzeImportData(diff: ImportDiff): ImportAlert[] {
  const alerts: ImportAlert[] = [];
  const allGuests = [...diff.added, ...diff.modified.map(m => m.existing)];

  // 1. Large batch warning
  if (diff.added.length > 50) {
    alerts.push({
      type: 'warning',
      title: 'Large Import Batch',
      description: `Adding ${diff.added.length} new guests at once. Consider reviewing in smaller batches.`,
      count: diff.added.length,
    });
  }

  // 2. High removal rate warning
  if (diff.removed.length > 10 && diff.removed.length > diff.added.length) {
    alerts.push({
      type: 'warning',
      title: 'High Removal Rate',
      description: `${diff.removed.length} guests will be removed. This is more than the ${diff.added.length} being added.`,
      count: diff.removed.length,
    });
  }

  // 3. Date consistency checks
  const dateIssues: string[] = [];
  [...diff.added, ...diff.modified.map(m => ({ ...m.existing, ...Object.fromEntries(m.changes.map(c => [c.field, c.newValue])) }))].forEach(guest => {
    const arrivalDate = guest.arrivalDate as string | null | undefined;
    const departureDate = guest.departureDate as string | null | undefined;
    const guestName = `${guest.firstName} ${guest.lastName}`;

    if (arrivalDate && departureDate) {
      if (new Date(arrivalDate) > new Date(departureDate)) {
        dateIssues.push(`${guestName}: Arrival after departure`);
      }
    }
  });

  if (dateIssues.length > 0) {
    alerts.push({
      type: 'error',
      title: 'Date Inconsistencies',
      description: `${dateIssues.length} guest(s) have arrival dates after departure dates.`,
      count: dateIssues.length,
      items: dateIssues.slice(0, 5),
    });
  }

  // 4. Missing flight info for guests needing transfer
  const missingFlightInfo: string[] = [];
  [...diff.added].forEach(guest => {
    const guestName = `${guest.firstName} ${guest.lastName}`;
    if (guest.needsArrivalTransfer && !guest.arrivalFlightNumber) {
      missingFlightInfo.push(`${guestName}: Needs arrival transfer but no flight`);
    }
    if (guest.needsDepartureTransfer && !guest.departureFlightNumber) {
      missingFlightInfo.push(`${guestName}: Needs departure transfer but no flight`);
    }
  });

  if (missingFlightInfo.length > 0) {
    alerts.push({
      type: 'warning',
      title: 'Missing Flight Information',
      description: `${missingFlightInfo.length} guest(s) need transfer but have no flight info.`,
      count: missingFlightInfo.length,
      items: missingFlightInfo.slice(0, 5),
    });
  }

  // 5. Potential duplicate names
  const nameCount = new Map<string, number>();
  [...diff.added, ...diff.unchanged].forEach(guest => {
    const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
    nameCount.set(fullName, (nameCount.get(fullName) || 0) + 1);
  });
  const duplicateNames = Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  if (duplicateNames.length > 0) {
    alerts.push({
      type: 'info',
      title: 'Potential Duplicate Names',
      description: `${duplicateNames.length} name(s) appear multiple times. Verify these are different people.`,
      count: duplicateNames.length,
      items: duplicateNames.slice(0, 5),
    });
  }

  // 6. Invalid email format
  const invalidEmails: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  diff.added.forEach(guest => {
    if (guest.email && !emailRegex.test(guest.email)) {
      invalidEmails.push(`${guest.firstName} ${guest.lastName}: ${guest.email}`);
    }
  });

  if (invalidEmails.length > 0) {
    alerts.push({
      type: 'error',
      title: 'Invalid Email Format',
      description: `${invalidEmails.length} guest(s) have invalid email addresses.`,
      count: invalidEmails.length,
      items: invalidEmails.slice(0, 5),
    });
  }

  // 7. Critical field changes
  const criticalChanges: string[] = [];
  diff.modified.forEach(({ existing, changes }) => {
    const guestName = `${existing.firstName} ${existing.lastName}`;
    const criticalFields = ['email', 'arrivalDate', 'departureDate', 'arrivalFlightNumber', 'departureFlightNumber'];
    const hasCritical = changes.some(c => criticalFields.includes(c.field));
    if (hasCritical) {
      criticalChanges.push(guestName);
    }
  });

  if (criticalChanges.length > 0) {
    alerts.push({
      type: 'info',
      title: 'Critical Field Updates',
      description: `${criticalChanges.length} guest(s) have changes to important fields (dates, flights, email).`,
      count: criticalChanges.length,
      items: criticalChanges.slice(0, 5),
    });
  }

  // 8. Same-day arrivals and departures (unusual but possible)
  const sameDayTrips: string[] = [];
  diff.added.forEach(guest => {
    if (guest.arrivalDate && guest.departureDate && guest.arrivalDate === guest.departureDate) {
      sameDayTrips.push(`${guest.firstName} ${guest.lastName}`);
    }
  });

  if (sameDayTrips.length > 0) {
    alerts.push({
      type: 'info',
      title: 'Same-Day Trips',
      description: `${sameDayTrips.length} guest(s) arrive and depart on the same day.`,
      count: sameDayTrips.length,
      items: sameDayTrips.slice(0, 5),
    });
  }

  return alerts;
}

// Alert icon component
function AlertIcon({ type }: { type: ImportAlert['type'] }) {
  switch (type) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

export function DiffViewer({
  diff,
  onApprove,
  onCancel,
  isApplying = false,
}: DiffViewerProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [removeDeleted, setRemoveDeleted] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);

  const summary = useMemo(
    () => ({
      added: diff.added.length,
      modified: diff.modified.length,
      removed: diff.removed.length,
      unchanged: diff.unchanged.length,
      errors: diff.errors.length,
      total:
        diff.added.length +
        diff.modified.length +
        diff.removed.length +
        diff.unchanged.length,
    }),
    [diff]
  );

  // Analyze import data for alerts
  const alerts = useMemo(() => analyzeImportData(diff), [diff]);
  const errorAlerts = alerts.filter(a => a.type === 'error');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  const infoAlerts = alerts.filter(a => a.type === 'info');

  const hasChanges = summary.added > 0 || summary.modified > 0;
  const hasIssues = summary.removed > 0 || summary.errors > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div
          className={cn(
            'rounded-lg border p-4 text-center',
            summary.added > 0 && 'border-green-200 bg-green-50'
          )}
        >
          <Plus className="mx-auto h-5 w-5 text-green-600" />
          <p className="mt-1 text-2xl font-bold text-green-600">{summary.added}</p>
          <p className="text-sm text-muted-foreground">New</p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4 text-center',
            summary.modified > 0 && 'border-amber-200 bg-amber-50'
          )}
        >
          <Pencil className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {summary.modified}
          </p>
          <p className="text-sm text-muted-foreground">Modified</p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4 text-center',
            summary.removed > 0 && 'border-red-200 bg-red-50'
          )}
        >
          <Trash2 className="mx-auto h-5 w-5 text-red-600" />
          <p className="mt-1 text-2xl font-bold text-red-600">{summary.removed}</p>
          <p className="text-sm text-muted-foreground">Removed</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="mt-1 text-2xl font-bold text-muted-foreground">
            {summary.unchanged}
          </p>
          <p className="text-sm text-muted-foreground">Unchanged</p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4 text-center',
            summary.errors > 0 && 'border-red-200 bg-red-50'
          )}
        >
          <AlertCircle className="mx-auto h-5 w-5 text-red-600" />
          <p className="mt-1 text-2xl font-bold text-red-600">{summary.errors}</p>
          <p className="text-sm text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Import Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4" />
              Import Analysis ({alerts.length} alert{alerts.length !== 1 ? 's' : ''})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlerts(!showAlerts)}
            >
              {showAlerts ? (
                <>
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          </div>

          {showAlerts && (
            <div className="space-y-2">
              {/* Error alerts */}
              {errorAlerts.map((alert, i) => (
                <Alert key={`error-${i}`} variant="destructive" className="border-red-200 bg-red-50">
                  <AlertIcon type="error" />
                  <AlertTitle className="text-red-800">{alert.title}</AlertTitle>
                  <AlertDescription className="text-red-700">
                    <p>{alert.description}</p>
                    {alert.items && alert.items.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {alert.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                        {alert.count && alert.count > 5 && (
                          <li className="text-red-500">...and {alert.count - 5} more</li>
                        )}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              ))}

              {/* Warning alerts */}
              {warningAlerts.map((alert, i) => (
                <Alert key={`warning-${i}`} className="border-amber-200 bg-amber-50">
                  <AlertIcon type="warning" />
                  <AlertTitle className="text-amber-800">{alert.title}</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <p>{alert.description}</p>
                    {alert.items && alert.items.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {alert.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                        {alert.count && alert.count > 5 && (
                          <li className="text-amber-500">...and {alert.count - 5} more</li>
                        )}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              ))}

              {/* Info alerts */}
              {infoAlerts.map((alert, i) => (
                <Alert key={`info-${i}`} className="border-blue-200 bg-blue-50">
                  <AlertIcon type="info" />
                  <AlertTitle className="text-blue-800">{alert.title}</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    <p>{alert.description}</p>
                    {alert.items && alert.items.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {alert.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                        {alert.count && alert.count > 5 && (
                          <li className="text-blue-500">...and {alert.count - 5} more</li>
                        )}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All Changes ({summary.added + summary.modified})
          </TabsTrigger>
          <TabsTrigger value="added" disabled={summary.added === 0}>
            Added ({summary.added})
          </TabsTrigger>
          <TabsTrigger value="modified" disabled={summary.modified === 0}>
            Modified ({summary.modified})
          </TabsTrigger>
          <TabsTrigger value="removed" disabled={summary.removed === 0}>
            Removed ({summary.removed})
          </TabsTrigger>
          <TabsTrigger value="errors" disabled={summary.errors === 0}>
            Errors ({summary.errors})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="mt-4 h-[400px] rounded-lg border">
          <TabsContent value="all" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.added.map((guest, i) => (
                  <AddedGuestRow key={`added-${i}`} guest={guest} />
                ))}
                {diff.modified.map(({ existing, changes }, i) => (
                  <ModifiedGuestRow
                    key={`modified-${i}`}
                    guest={existing}
                    changes={changes}
                  />
                ))}
                {(diff.added.length === 0 && diff.modified.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No changes to apply
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="added" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.added.map((guest, i) => (
                  <AddedGuestRow key={i} guest={guest} />
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="modified" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-32">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.modified.map(({ existing, changes }, i) => (
                  <ModifiedGuestRow key={i} guest={existing} changes={changes} />
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="removed" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.removed.map((guest, i) => (
                  <RemovedGuestRow key={i} guest={guest} />
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="errors" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Row</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.errors.map((error, i) => (
                  <ErrorRow key={i} row={error.row} errors={error.errors} />
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Unchanged toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUnchanged(!showUnchanged)}
        >
          {showUnchanged ? (
            <EyeOff className="mr-2 h-4 w-4" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          {showUnchanged ? 'Hide' : 'Show'} {summary.unchanged} unchanged guests
        </Button>
      </div>

      {showUnchanged && (
        <ScrollArea className="h-48 rounded-lg border">
          <Table>
            <TableBody>
              {diff.unchanged.map((guest, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {guest.firstName} {guest.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {guest.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Remove deleted checkbox */}
      {summary.removed > 0 && (
        <div className="flex items-center space-x-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <Checkbox
            id="removeDeleted"
            checked={removeDeleted}
            onCheckedChange={(checked) => setRemoveDeleted(checked === true)}
          />
          <label
            htmlFor="removeDeleted"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Also remove {summary.removed} guest{summary.removed !== 1 ? 's' : ''}{' '}
            not found in this import (soft delete)
          </label>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isApplying}>
          Cancel
        </Button>
        <Button
          onClick={() => onApprove({ removeDeleted })}
          disabled={!hasChanges || isApplying}
        >
          {isApplying ? 'Applying...' : `Apply ${summary.added + summary.modified} Changes`}
        </Button>
      </div>
    </div>
  );
}
