'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { MobileNav } from './mobile-nav';
import { ChatbotWidget } from '@/components/chatbot/chatbot-widget';

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: 'event_registration_crew' | 'transport_arranger';
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <Sidebar user={user} />
      </div>

      {/* Mobile sidebar */}
      <Sidebar
        user={user}
        mobile
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="lg:pl-64">
        <Header
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="pb-20 lg:pb-8">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav user={user} />

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
