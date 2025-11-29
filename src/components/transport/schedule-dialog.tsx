'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

const scheduleSchema = z.object({
  vehicleId: z.string().uuid('Please select a vehicle'),
  direction: z.enum(['arrival', 'departure']),
  scheduleDate: z.string().min(1, 'Date is required'),
  pickupTime: z.string().min(1, 'Time is required'),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  notes: z.string().optional(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: {
    id: string;
    vehicleId: string | null;
    direction: 'arrival' | 'departure';
    scheduleDate: string;
    pickupTime: string;
    pickupLocation?: string | null;
    dropoffLocation?: string | null;
    notes?: string | null;
  } | null;
  onSubmit: (data: ScheduleFormData) => void;
  isSubmitting?: boolean;
  defaultDate?: string;
  defaultDirection?: 'arrival' | 'departure';
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSubmit,
  isSubmitting = false,
  defaultDate,
  defaultDirection = 'arrival',
}: ScheduleDialogProps) {
  const { data: vehicles } = trpc.transport.vehicles.list.useQuery();

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      vehicleId: '',
      direction: defaultDirection,
      scheduleDate: defaultDate || new Date().toISOString().split('T')[0],
      pickupTime: '09:00',
      pickupLocation: '',
      dropoffLocation: '',
      notes: '',
    },
  });

  // Reset form when schedule changes
  useEffect(() => {
    if (schedule) {
      form.reset({
        vehicleId: schedule.vehicleId || '',
        direction: schedule.direction,
        scheduleDate: schedule.scheduleDate,
        pickupTime: schedule.pickupTime,
        pickupLocation: schedule.pickupLocation || '',
        dropoffLocation: schedule.dropoffLocation || '',
        notes: schedule.notes || '',
      });
    } else {
      form.reset({
        vehicleId: '',
        direction: defaultDirection,
        scheduleDate: defaultDate || new Date().toISOString().split('T')[0],
        pickupTime: '09:00',
        pickupLocation: '',
        dropoffLocation: '',
        notes: '',
      });
    }
  }, [schedule, form, defaultDate, defaultDirection]);

  const direction = form.watch('direction');

  const handleSubmit = (data: ScheduleFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {schedule ? 'Edit Schedule' : 'Create Schedule'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="arrival">
                          Arrival (Airport → Hotel)
                        </SelectItem>
                        <SelectItem value="departure">
                          Departure (Hotel → Airport)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} ({vehicle.capacity} seats)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pickupTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="pickupLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Pickup Location
                    {direction === 'arrival' && ' (Airport)'}
                    {direction === 'departure' && ' (Hotel)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        direction === 'arrival'
                          ? 'e.g., KLIA Terminal 1, Arrival Hall'
                          : 'e.g., Shangri-La Hotel Lobby'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dropoffLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Drop-off Location
                    {direction === 'arrival' && ' (Hotel)'}
                    {direction === 'departure' && ' (Airport)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        direction === 'arrival'
                          ? 'e.g., Shangri-La Hotel'
                          : 'e.g., KLIA Terminal 1'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special instructions..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {schedule ? 'Save Changes' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
