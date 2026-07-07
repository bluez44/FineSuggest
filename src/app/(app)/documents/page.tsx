import { requireUser } from '@/lib/auth/requireUser';
import { DocumentsPageClient } from '@/components/documents/DocumentsPageClient';

export default async function DocumentsPage() {
  await requireUser();
  return <DocumentsPageClient />;
}
