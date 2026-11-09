export type MediaType = 'BOOK' | 'CD' | 'DVD';

export type LoanStatus =
  | 'LOANED'
  | 'NOT_STARTED'
  | 'READING'
  | 'READ'
  | 'READ_RETURNED'
  | 'UNREAD_RETURNED';

export interface LoanItem {
  id: number;
  isbn: string | null;
  mediaType: MediaType;
  title: string;
  author: string | null;
  /** Null for the user's own items. */
  library: string | null;
  /** Null for the user's own items, which have no return deadline. */
  dueDate: string | null;
  status: LoanStatus;
}
