'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';

interface MobileNavProps {
  showAdmin: boolean;
}

export function MobileNav({ showAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:bg-white/5 border border-white/5 h-9 w-9 rounded-lg">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-background/95 backdrop-blur-2xl border-r border-white/[0.08] shadow-2xl">
        <Sidebar showAdmin={showAdmin} />
      </SheetContent>
    </Sheet>
  );
}
