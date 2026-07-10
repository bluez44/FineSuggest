'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FileText, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  showAdmin: boolean;
}

export function Sidebar({ showAdmin }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: '/chat',
      label: 'Trò chuyện',
      icon: MessageSquare,
      active: pathname.startsWith('/chat'),
    },
    {
      href: '/documents',
      label: 'Tài liệu của tôi',
      icon: FileText,
      active: pathname.startsWith('/documents'),
    },
    ...(showAdmin
      ? [
          {
            href: '/admin',
            label: 'Quản trị',
            icon: Shield,
            active: pathname.startsWith('/admin'),
          },
        ]
      : []),
  ];

  return (
    <nav className="flex h-full w-[260px] flex-col bg-sidebar/50 p-4 justify-between">
      <div className="space-y-6">
        <div className="space-y-1.5">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
                  link.active
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', link.active ? 'text-current' : 'text-muted-foreground/80')} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Decorative footer */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
          <span>Phiên bản v1.0.0</span>
        </div>
        <p className="text-[10.5px] text-muted-foreground/75 leading-normal">
          Trợ lý hỗ trợ giải đáp pháp luật giao thông đường bộ Việt Nam.
        </p>
      </div>
    </nav>
  );
}
