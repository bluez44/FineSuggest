import type { LoaderInput, RawDoc } from '@/lib/ingestion/types';

/** Strategy: extract text + metadata from a specific source format. */
export interface DocumentLoader {
  load(input: LoaderInput): Promise<RawDoc>;
}
