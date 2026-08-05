import { MediaType, ParsedLoanItem } from '../loan-item';

/**
 * Parses the loans table HTML copied from the library's account page
 * (rTable markup). Each row holds: checkbox, due date (dd.mm.yyyy),
 * library branch, a title cell with <br>-separated lines
 * ([media kind], title / author, category, barcode) and a note cell.
 */
export function parseLoanTable(html: string): ParsedLoanItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return [...doc.querySelectorAll('table tbody tr')]
    .map(parseRow)
    .filter((item): item is ParsedLoanItem => item !== null);
}

function parseRow(row: Element): ParsedLoanItem | null {
  const cells = [...row.querySelectorAll('td')];

  if (cells.length < 4) {
    return null;
  }

  // Address cells from the end so a missing checkbox column doesn't shift them.
  const [dueCell, libraryCell, titleCell, noteCell] = cells.slice(-4);

  const dueDate = parseDueDate(dueCell.textContent ?? '');
  const library = (libraryCell.textContent ?? '').trim();
  const titleLines = cellLines(titleCell);
  const barcode = titleLines.find((line) => /^\d{8,}$/.test(line));

  if (!dueDate || !library || !barcode) {
    return null;
  }

  const mediaLine = titleLines.find((line) => /^\[.+\]$/.test(line));
  const titleAuthorLine = titleLines.find(
    (line) => line !== mediaLine && line !== barcode
  );

  if (!titleAuthorLine) {
    return null;
  }

  const category =
    titleLines.find(
      (line) =>
        line !== mediaLine && line !== barcode && line !== titleAuthorLine
    ) ?? null;

  return {
    barcode,
    mediaType: parseMediaType(mediaLine),
    ...parseTitleAndAuthor(titleAuthorLine),
    category,
    library,
    dueDate,
    note: cellLines(noteCell)[0] ?? null,
  };
}

function parseDueDate(text: string): string | null {
  const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function parseMediaType(mediaLine: string | undefined): MediaType {
  return mediaLine?.toLowerCase().includes('cd') ? 'CD' : 'BOOK';
}

function parseTitleAndAuthor(line: string): {
  title: string;
  author: string | null;
} {
  const cleaned = line.replace(/¬/g, '').replace(/\s+/g, ' ').trim();
  const [title, ...authorParts] = cleaned.split(' / ');
  const author = authorParts
    .join(' / ')
    .split(';')[0]
    .replace(/^von\s+/i, '')
    .trim();

  return { title: title.trim(), author: author || null };
}

function cellLines(cell: Element): string[] {
  const lines: string[] = [];
  let current = '';

  cell.childNodes.forEach((node) => {
    if (node.nodeName === 'BR') {
      lines.push(current);
      current = '';
    } else {
      current += node.textContent ?? '';
    }
  });
  lines.push(current);

  return lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}
