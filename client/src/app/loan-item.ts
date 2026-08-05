export type MediaType = 'BOOK' | 'CD';

export interface LoanItem {
  id: number;
  barcode: string;
  mediaType: MediaType;
  title: string;
  author: string | null;
  category: string | null;
  library: string;
  dueDate: string;
  note: string | null;
  completed: boolean;
}

export interface ParsedLoanItem {
  barcode: string;
  mediaType: MediaType;
  title: string;
  author: string | null;
  category: string | null;
  library: string;
  dueDate: string;
  note: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
}
