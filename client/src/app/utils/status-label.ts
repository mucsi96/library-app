import { LoanStatus, MediaType } from '../loan-item';

export const LOAN_STATUSES: readonly LoanStatus[] = [
  'LOANED',
  'READING',
  'READ',
  'RETURNED',
];

const BOOK_LABELS: Record<LoanStatus, string> = {
  LOANED: 'Loaned',
  READING: 'Reading',
  READ: 'Read',
  RETURNED: 'Returned',
};

const CD_LABELS: Record<LoanStatus, string> = {
  ...BOOK_LABELS,
  READING: 'Listening',
  READ: 'Listened',
};

export function statusLabel(status: LoanStatus, mediaType: MediaType): string {
  return (mediaType === 'CD' ? CD_LABELS : BOOK_LABELS)[status];
}
