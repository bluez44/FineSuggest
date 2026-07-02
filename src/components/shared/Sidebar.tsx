import Link from 'next/link';

interface SidebarProps {
  showAdmin: boolean;
}

export function Sidebar({ showAdmin }: SidebarProps) {
  return (
    <nav className="flex h-full w-[280px] flex-col border-r bg-slate-50 p-4">
      <div className="space-y-1">
        <Link href="/chat" className="block rounded-lg px-3 py-2 hover:bg-slate-200">
          Trò chuyện
        </Link>
        <Link href="/documents" className="block rounded-lg px-3 py-2 hover:bg-slate-200">
          Tài liệu của tôi
        </Link>
        {showAdmin && (
          <Link href="/admin" className="block rounded-lg px-3 py-2 hover:bg-slate-200">
            Quản trị
          </Link>
        )}
      </div>
    </nav>
  );
}
