import { Badge } from '@/components/ui/badge';

type Status = 'pending' | 'processing' | 'ready' | 'failed';

const LABEL: Record<Status, string> = {
  pending: 'Đang chờ',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Thất bại',
};

const VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  processing: 'secondary',
  ready: 'default',
  failed: 'destructive',
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
