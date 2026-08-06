import { BookMetadata, ParsedLoanItem } from '../loan-item';

const VOLUMES_URL = 'https://www.googleapis.com/books/v1/volumes';

interface VolumesResponse {
  items?: {
    volumeInfo?: {
      industryIdentifiers?: { type: string; identifier: string }[];
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    };
  }[];
}

/**
 * Looks up a loan item on Google Books to pull its ISBN and cover thumbnail.
 * An already known ISBN is used as the query since it identifies the exact
 * edition; otherwise the title/author are searched. The lookup is best
 * effort: a miss or network failure yields null fields so an import never
 * depends on the external service.
 */
export async function fetchBookMetadata(
  item: ParsedLoanItem,
  knownIsbn: string | null
): Promise<BookMetadata> {
  try {
    const query = knownIsbn
      ? `isbn:${knownIsbn}`
      : [
          `intitle:"${item.title}"`,
          ...(item.author ? [`inauthor:"${item.author}"`] : []),
        ].join(' ');
    const params = new URLSearchParams({
      q: query,
      maxResults: '1',
      fields: 'items(volumeInfo(industryIdentifiers,imageLinks))',
    });
    const response = await fetch(`${VOLUMES_URL}?${params}`);

    if (!response.ok) {
      return { isbn: knownIsbn, thumbnailUrl: null };
    }

    const data: VolumesResponse = await response.json();
    const volumeInfo = data.items?.[0]?.volumeInfo;

    return {
      isbn: knownIsbn ?? findIsbn(volumeInfo?.industryIdentifiers),
      thumbnailUrl: findThumbnailUrl(volumeInfo?.imageLinks),
    };
  } catch {
    return { isbn: knownIsbn, thumbnailUrl: null };
  }
}

function findIsbn(
  identifiers: { type: string; identifier: string }[] | undefined
): string | null {
  return (
    ['ISBN_13', 'ISBN_10']
      .map(
        (type) => identifiers?.find((entry) => entry.type === type)?.identifier
      )
      .find(Boolean) ?? null
  );
}

function findThumbnailUrl(
  imageLinks: { thumbnail?: string; smallThumbnail?: string } | undefined
): string | null {
  const url = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail ?? null;
  // Google Books returns http:// links; upgrade to avoid mixed content.
  return url?.replace(/^http:\/\//, 'https://') ?? null;
}
