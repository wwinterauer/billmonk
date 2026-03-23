import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main
        className={cn(
          'transition-all duration-300 p-6',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <AnnouncementBanner />
        {children}
      </main>
    </div>
  );
}
