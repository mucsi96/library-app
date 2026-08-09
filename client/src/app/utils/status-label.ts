import { LoanStatus, MediaType } from '../loan-item';

export const LOAN_STATUSES: readonly LoanStatus[] = [
  'LOANED',
  'READING',
  'READ',
  'READ_RETURNED',
  'UNREAD_RETURNED',
];

const BOOK_LABELS: Record<LoanStatus, string> = {
  LOANED: 'Loaned',
  READING: 'Reading',
  READ: 'Read',
  READ_RETURNED: 'Read & returned',
  UNREAD_RETURNED: 'Returned unread',
};

const CD_LABELS: Record<LoanStatus, string> = {
  ...BOOK_LABELS,
  READING: 'Listening',
  READ: 'Listened',
  READ_RETURNED: 'Listened & returned',
  UNREAD_RETURNED: 'Returned unlistened',
};

export function statusLabel(status: LoanStatus, mediaType: MediaType): string {
  return (mediaType === 'CD' ? CD_LABELS : BOOK_LABELS)[status];
}
