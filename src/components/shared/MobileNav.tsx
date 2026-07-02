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
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <Sidebar showAdmin={showAdmin} />
      </SheetContent>
    </Sheet>
  );
}
