export type MediaType = 'BOOK' | 'CD';

export type LoanStatus = 'LOANED' | 'READING' | 'READ' | 'RETURNED';

export interface LoanItem {
  id: number;
  isbn: string | null;
  mediaType: MediaType;
  title: string;
  author: string | null;
  library: string | null;
  dueDate: string;
  status: LoanStatus;
}
