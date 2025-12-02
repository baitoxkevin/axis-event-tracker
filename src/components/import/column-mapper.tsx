'use client';

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Check, X, Wand2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Guest field definitions for mapping
const GUEST_FIELDS = [
  { key: 'email', label: 'Email', required: true, group: 'Basic Info' },
  { key: 'salutation', label: 'Salutation', required: false, group: 'Basic Info' },
  { key: 'firstName', label: 'First Name', required: true, group: 'Basic Info' },
  { key: 'lastName', label: 'Last Name', required: true, group: 'Basic Info' },
  { key: 'axisEmail', label: 'Axis Email', required: false, group: 'Basic Info' },
  { key: 'reportingLevel1', label: 'Reporting Level 1', required: false, group: 'Organization' },
  { key: 'reportingLevel2', label: 'Reporting Level 2', required: false, group: 'Organization' },
  { key: 'reportingLevel3', label: 'Reporting Level 3', required: false, group: 'Organization' },
  { key: 'function', label: 'Function', required: false, group: 'Organization' },
  { key: 'location', label: 'Location', required: false, group: 'Organization' },
  { key: 'arrivalDate', label: 'Arrival Date', required: false, group: 'Flight - Arrival' },
  { key: 'arrivalTime', label: 'Arrival Time', required: false, group: 'Flight - Arrival' },
  { key: 'arrivalFlightNumber', label: 'Arrival Flight Number', required: false, group: 'Flight - Arrival' },
  { key: 'arrivalAirport', label: 'Arrival Airport', required: false, group: 'Flight - Arrival' },
  { key: 'arrivalFlightRoute', label: 'Arrival Flight Route', required: false, group: 'Flight - Arrival' },
  { key: 'departureDate', label: 'Departure Date', required: false, group: 'Flight - Departure' },
  { key: 'departureTime', label: 'Departure Time', required: false, group: 'Flight - Departure' },
  { key: 'departureFlightNumber', label: 'Departure Flight Number', required: false, group: 'Flight - Departure' },
  { key: 'departureAirport', label: 'Departure Airport', required: false, group: 'Flight - Departure' },
  { key: 'departureFlightRoute', label: 'Departure Flight Route', required: false, group: 'Flight - Departure' },
  { key: 'hotelCheckinDate', label: 'Hotel Check-in Date', required: false, group: 'Hotel' },
  { key: 'hotelCheckoutDate', label: 'Hotel Check-out Date', required: false, group: 'Hotel' },
  { key: 'hotelConfirmationNumber', label: 'Hotel Confirmation Number', required: false, group: 'Hotel' },
  { key: 'extendStayBefore', label: 'Extend Stay Before', required: false, group: 'Hotel' },
  { key: 'extendStayAfter', label: 'Extend Stay After', required: false, group: 'Hotel' },
  { key: 'earlyCheckin', label: 'Early Check-in', required: false, group: 'Hotel' },
  { key: 'lateCheckout', label: 'Late Check-out', required: false, group: 'Hotel' },
  { key: 'needsArrivalTransfer', label: 'Needs Arrival Transfer', required: false, group: 'Transport' },
  { key: 'needsDepartureTransfer', label: 'Needs Departure Transfer', required: false, group: 'Transport' },
  { key: 'registrationStatus', label: 'Registration Status', required: false, group: 'Status' },
  { key: 'travelType', label: 'Travel Type', required: false, group: 'Status' },
];

// Auto-mapping patterns
const AUTO_MAP_PATTERNS: Record<string, string[]> = {
  email: ['email', 'e-mail', 'email address', 'e-mail address'],
  salutation: ['salutation', 'title', 'mr', 'mrs', 'ms', 'dr', 'prefix'],
  firstName: ['first name', 'firstname', 'given name', 'first'],
  lastName: ['last name', 'lastname', 'family name', 'surname', 'last'],
  axisEmail: ['axis email', 'work email', 'corporate email'],
  reportingLevel1: ['reporting level 1', 'level 1', 'department', 'org level 1'],
  reportingLevel2: ['reporting level 2', 'level 2', 'team', 'org level 2'],
  reportingLevel3: ['reporting level 3', 'level 3', 'sub-team', 'org level 3'],
  function: ['function', 'role', 'job function'],
  location: ['location', 'office', 'city', 'country'],
  arrivalDate: ['arrival date', 'arriving', 'flight arrival date', 'arrival'],
  arrivalTime: ['arrival time', 'arrival flight time', 'arriving time'],
  arrivalFlightNumber: ['arrival flight', 'flight number', 'arrival flight number', 'flight in'],
  arrivalAirport: ['arrival airport', 'arriving airport'],
  departureDate: ['departure date', 'departing', 'flight departure date', 'departure'],
  departureTime: ['departure time', 'departure flight time', 'departing time'],
  departureFlightNumber: ['departure flight', 'departure flight number', 'flight out'],
  departureAirport: ['departure airport', 'departing airport'],
  hotelCheckinDate: ['check-in date', 'checkin date', 'hotel check-in', 'check in'],
  hotelCheckoutDate: ['check-out date', 'checkout date', 'hotel check-out', 'check out'],
  hotelConfirmationNumber: ['confirmation number', 'hotel confirmation', 'booking number', 'reservation number', 'confirmation'],
  needsArrivalTransfer: ['arrival transfer', 'airport transfer arrival', 'need arrival transfer'],
  needsDepartureTransfer: ['departure transfer', 'airport transfer departure', 'need departure transfer'],
  registrationStatus: ['status', 'registration status', 'reg status'],
  travelType: ['travel type', 'travel', 'type'],
};

interface ColumnMapperProps {
  excelColumns: string[];
  sampleData: Record<string, unknown>[];
  mapping: Record<string, string | null>;
  onMappingChange: (mapping: Record<string, string | null>) => void;
}

export function ColumnMapper({
  excelColumns,
  sampleData,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  const [showPreview, setShowPreview] = useState(true);

  // Check which required fields are mapped
  const requiredFields = GUEST_FIELDS.filter((f) => f.required);
  const mappedRequired = requiredFields.filter((f) =>
    Object.values(mapping).includes(f.key)
  );
  const missingRequired = requiredFields.filter(
    (f) => !Object.values(mapping).includes(f.key)
  );

  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof GUEST_FIELDS> = {};
    GUEST_FIELDS.forEach((field) => {
      if (!groups[field.group]) {
        groups[field.group] = [];
      }
      groups[field.group].push(field);
    });
    return groups;
  }, []);

  // Auto-map columns based on patterns
  const autoMap = () => {
    const newMapping: Record<string, string | null> = {};

    excelColumns.forEach((col) => {
      const colLower = col.toLowerCase().trim();

      // Find matching field
      for (const [fieldKey, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
        if (patterns.some((p) => colLower.includes(p) || p.includes(colLower))) {
          // Check if this field isn't already mapped
          if (!Object.values(newMapping).includes(fieldKey)) {
            newMapping[col] = fieldKey;
            break;
          }
        }
      }

      // If no match found, keep unmapped
      if (!(col in newMapping)) {
        newMapping[col] = null;
      }
    });

    onMappingChange(newMapping);
  };

  // Clear all mappings
  const clearAll = () => {
    const newMapping: Record<string, string | null> = {};
    excelColumns.forEach((col) => {
      newMapping[col] = null;
    });
    onMappingChange(newMapping);
  };

  // Update single mapping
  const updateMapping = (excelCol: string, guestField: string | null) => {
    // If mapping to a field that's already mapped, clear the old mapping
    if (guestField) {
      const existingCol = Object.entries(mapping).find(
        ([, value]) => value === guestField
      )?.[0];
      if (existingCol && existingCol !== excelCol) {
        onMappingChange({
          ...mapping,
          [existingCol]: null,
          [excelCol]: guestField,
        });
        return;
      }
    }

    onMappingChange({
      ...mapping,
      [excelCol]: guestField,
    });
  };

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {missingRequired.length === 0 ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <X className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm">
              {mappedRequired.length}/{requiredFields.length} required fields mapped
            </span>
          </div>
          {missingRequired.length > 0 && (
            <div className="flex gap-1">
              {missingRequired.map((f) => (
                <Badge key={f.key} variant="destructive" className="text-xs">
                  {f.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear All
          </Button>
          <Button variant="outline" size="sm" onClick={autoMap}>
            <Wand2 className="mr-2 h-4 w-4" />
            Auto-Map
          </Button>
        </div>
      </div>

      {/* Mapping table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Excel Column</TableHead>
              <TableHead className="w-1/3">Map To</TableHead>
              <TableHead className="w-1/3">Sample Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {excelColumns.map((col) => (
              <TableRow key={col}>
                <TableCell className="font-medium">{col}</TableCell>
                <TableCell>
                  <Select
                    value={mapping[col] || 'unmapped'}
                    onValueChange={(value) =>
                      updateMapping(col, value === 'unmapped' ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">
                        <span className="text-muted-foreground">-- Don&apos;t import --</span>
                      </SelectItem>
                      {Object.entries(groupedFields).map(([group, fields]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {group}
                          </div>
                          {fields.map((field) => {
                            const isMapped =
                              Object.values(mapping).includes(field.key) &&
                              mapping[col] !== field.key;
                            return (
                              <SelectItem
                                key={field.key}
                                value={field.key}
                                disabled={isMapped}
                              >
                                <span className="flex items-center gap-2">
                                  {field.label}
                                  {field.required && (
                                    <span className="text-red-500">*</span>
                                  )}
                                  {isMapped && (
                                    <span className="text-xs text-muted-foreground">
                                      (already mapped)
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {sampleData[0]?.[col] !== undefined
                    ? String(sampleData[0][col]).slice(0, 50)
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Sample data preview */}
      {showPreview && sampleData.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Data Preview (first 3 rows)</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(false)}
            >
              Hide Preview
            </Button>
          </div>
          <ScrollArea className="rounded-lg border">
            <div className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    {excelColumns.slice(0, 8).map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                    {excelColumns.length > 8 && (
                      <TableHead>+{excelColumns.length - 8} more</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleData.slice(0, 3).map((row, i) => (
                    <TableRow key={i}>
                      {excelColumns.slice(0, 8).map((col) => (
                        <TableCell
                          key={col}
                          className="max-w-32 truncate text-sm"
                        >
                          {row[col] !== undefined ? String(row[col]) : '-'}
                        </TableCell>
                      ))}
                      {excelColumns.length > 8 && <TableCell>...</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
