import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

interface AppShellProps {
  email: string;
  showAdmin: boolean;
  children: ReactNode;
}

export function AppShell({ email, showAdmin, children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Mobile view Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-background/80 backdrop-blur-xl md:hidden px-2 py-1">
        <MobileNav showAdmin={showAdmin} />
        <Header email={email} />
      </div>

      {/* Desktop view Header */}
      <div className="hidden md:block">
        <Header email={email} />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="hidden md:block border-r border-white/[0.08] bg-sidebar w-[260px] shrink-0">
          <Sidebar showAdmin={showAdmin} />
        </aside>
        <main className="flex-1 overflow-y-auto bg-background/50 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
