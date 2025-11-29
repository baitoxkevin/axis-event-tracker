'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Bus,
  Plane,
  FileText,
  Settings,
  Upload,
  X,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: 'event_registration_crew' | 'transport_arranger';
  };
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Guests', href: '/guests', icon: Users },
  { name: 'Transport', href: '/transport', icon: Bus },
  { name: 'Flights', href: '/flights', icon: Plane },
  { name: 'Itinerary', href: '/itinerary', icon: CalendarDays },
  { name: 'Audit Log', href: '/audit', icon: FileText, crewOnly: true },
];

const secondaryNavigation = [
  { name: 'Import Data', href: '/guests/import', icon: Upload, crewOnly: true },
  { name: 'Settings', href: '/settings', icon: Settings, crewOnly: true },
];

export function Sidebar({ user, mobile, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isCrew = user.role === 'event_registration_crew';

  const filteredNav = navigation.filter((item) => !item.crewOnly || isCrew);
  const filteredSecondary = secondaryNavigation.filter(
    (item) => !item.crewOnly || isCrew
  );

  const SidebarContent = (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-card px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <span className="text-xl font-bold text-primary">AXIS</span>
        <span className="ml-2 text-sm text-muted-foreground">Event Tracker</span>
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {filteredNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <item.icon
                        className={cn('h-5 w-5 shrink-0')}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>

          {filteredSecondary.length > 0 && (
            <>
              <Separator />
              <li>
                <div className="text-xs font-semibold leading-6 text-muted-foreground">
                  Management
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {filteredSecondary.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <item.icon
                            className="h-5 w-5 shrink-0"
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </>
          )}

          <li className="mt-auto">
            <div className="rounded-md bg-accent p-3">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {user.role.replace(/_/g, ' ')}
              </p>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="left" className="w-64 p-0">
          {SidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card">
      {SidebarContent}
    </div>
  );
}
