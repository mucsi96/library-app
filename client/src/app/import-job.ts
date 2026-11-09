import { MediaType } from './loan-item';

export type ImportJobStatus =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'NEEDS_ISBN'
  | 'GENERATING_COVER'
  | 'COMPLETED'
  | 'FAILED';

/**
 * An import being worked on in the background. Title and author arrive as
 * soon as the ISBN has been read, before the cover exists.
 */
export interface ImportJob {
  reference: string;
  status: ImportJobStatus;
  isbn: string | null;
  title: string | null;
  author: string | null;
  mediaType: MediaType | null;
  library: string | null;
  itemId: number | null;
  errorDetail: string | null;
  createdAt: string;
}

/** Jobs the background worker is done with — finished or waiting on the user. */
export const isSettled = (job: ImportJob): boolean =>
  job.status === 'COMPLETED' ||
  job.status === 'FAILED' ||
  job.status === 'NEEDS_ISBN';
