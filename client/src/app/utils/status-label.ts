import { LoanStatus, MediaType } from '../loan-item';

// Statuses a borrowed item can take; "loaned" already covers an item the
// user has not started yet.
export const LOAN_STATUSES: readonly LoanStatus[] = [
  'LOANED',
  'READING',
  'READ',
  'READ_RETURNED',
  'UNREAD_RETURNED',
];

// Own items are never loaned or returned; they sit unread on the shelf
// until the user starts them, then only the progress applies.
export const OWN_STATUSES: readonly LoanStatus[] = ['UNREAD', 'READING', 'READ'];

// Every status an item can carry, for the filter chips.
export const ALL_STATUSES: readonly LoanStatus[] = [
  'LOANED',
  'UNREAD',
  'READING',
  'READ',
  'READ_RETURNED',
  'UNREAD_RETURNED',
];

const BOOK_LABELS: Record<LoanStatus, string> = {
  LOANED: 'Loaned',
  UNREAD: 'Unread',
  READING: 'Reading',
  READ: 'Read',
  READ_RETURNED: 'Read & returned',
  UNREAD_RETURNED: 'Returned unread',
};

const CD_LABELS: Record<LoanStatus, string> = {
  ...BOOK_LABELS,
  UNREAD: 'Unlistened',
  READING: 'Listening',
  READ: 'Listened',
  READ_RETURNED: 'Listened & returned',
  UNREAD_RETURNED: 'Returned unlistened',
};

const DVD_LABELS: Record<LoanStatus, string> = {
  ...BOOK_LABELS,
  UNREAD: 'Unwatched',
  READING: 'Watching',
  READ: 'Watched',
  READ_RETURNED: 'Watched & returned',
  UNREAD_RETURNED: 'Returned unwatched',
};

const STATUS_LABELS: Record<MediaType, Record<LoanStatus, string>> = {
  BOOK: BOOK_LABELS,
  CD: CD_LABELS,
  DVD: DVD_LABELS,
};

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  BOOK: 'Book',
  CD: 'CD',
  DVD: 'DVD',
};

export function statusLabel(status: LoanStatus, mediaType: MediaType): string {
  return STATUS_LABELS[mediaType][status];
}

export function mediaTypeLabel(mediaType: MediaType): string {
  return MEDIA_TYPE_LABELS[mediaType];
}
