import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'pending' | 'processing' | 'ready' | 'failed';

const LABEL: Record<Status, string> = {
  pending: 'Đang chờ',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Thất bại',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-sm select-none',
        status === 'ready' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
        status === 'processing' && 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5 animate-pulse-slow',
        status === 'pending' && 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5',
        status === 'failed' && 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5'
      )}
    >
      {LABEL[status]}
    </Badge>
  );
}
