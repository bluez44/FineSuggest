import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      <Link href="/chat" className="text-lg font-semibold">
        FineSuggest
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-xs text-slate-500" disabled>
            {email}
          </DropdownMenuItem>
          <form action="/api/auth/signout" method="post">
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left">
                Đăng xuất
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
