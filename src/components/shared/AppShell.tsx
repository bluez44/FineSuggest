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
    <div className="flex h-screen flex-col">
      <div className="flex items-center md:hidden">
        <MobileNav showAdmin={showAdmin} />
        <Header email={email} />
      </div>
      <div className="hidden md:block">
        <Header email={email} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:block">
          <Sidebar showAdmin={showAdmin} />
        </aside>
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </div>
  );
}
