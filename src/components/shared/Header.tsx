import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.08] bg-background/70 backdrop-blur-xl px-6 sticky top-0 z-50">
      <Link href="/chat" className="flex items-center gap-2 group">
        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
          FineSuggest
        </span>
      </Link>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0 border border-white/10 hover:bg-white/5 bg-transparent overflow-hidden">
            <Avatar className="h-full w-full">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-xs font-semibold text-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 glass-card border border-white/[0.08] bg-popover/90 backdrop-blur-xl p-1 shadow-2xl rounded-xl">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-white/[0.06] mb-1">
            <span className="block font-medium text-foreground truncate">{email}</span>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5 block">Thành viên FineSuggest</span>
          </div>
          
          <form action="/api/auth/signout" method="post">
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full flex items-center gap-2 text-sm text-red-400 hover:text-red-300 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-red-500/10 transition-colors">
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất</span>
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
