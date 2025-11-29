'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Bus, Plane, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Settings, Upload, CalendarDays } from 'lucide-react';

interface MobileNavProps {
  user: {
    role: 'event_registration_crew' | 'transport_arranger';
  };
}

export function MobileNav({ user }: MobileNavProps) {
  const pathname = usePathname();
  const isCrew = user.role === 'event_registration_crew';

  const mainNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Guests', href: '/guests', icon: Users },
    { name: 'Transport', href: '/transport', icon: Bus },
    { name: 'Flights', href: '/flights', icon: Plane },
  ];

  const moreNav = [
    { name: 'Itinerary', href: '/itinerary', icon: CalendarDays },
    { name: 'Audit Log', href: '/audit', icon: FileText, crewOnly: true },
    { name: 'Import Data', href: '/guests/import', icon: Upload, crewOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings, crewOnly: true },
  ].filter((item) => !item.crewOnly || isCrew);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background lg:hidden">
      <div className="flex h-16 items-center justify-around px-4">
        {mainNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}

        {moreNav.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs font-medium">More</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {moreNav.map((item) => (
                <DropdownMenuItem key={item.name} asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
