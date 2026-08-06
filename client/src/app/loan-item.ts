export type MediaType = 'BOOK' | 'CD';

export interface LoanItem {
  id: number;
  isbn: string | null;
  mediaType: MediaType;
  title: string;
  author: string | null;
  library: string | null;
  dueDate: string;
  completed: boolean;
}
