// Solid color 10x10 PNGs, source: https://png-pixel.com
// The E2E tests upload these exact images as photos, so the handlers can
// key their canned answers off the pixel color.
export const IMAGES = {
  yellow: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5/hPwMRgHFUIX0VAgAYyB3tBFoR2wAAAABJRU5ErkJggg==',
  red: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8AARIQB46hC+ioEAGX8E/cKr6qsAAAAAElFTkSuQmCC',
  blue: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPj/n4EIwDiqkL4KAVIQE/f1/NxEAAAAAElFTkSuQmCC',
  green: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mNk+A+ERADGUYX0VQgAXAYT9xTSUocAAAAASUVORK5CYII=',
  purple: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR42mNoYGjAgxhGpbEhAJC6ZAEYInNtAAAAAElFTkSuQmCC',
};

export interface ExtractedItem {
  isbn: string | null;
  title: string | null;
  author: string | null;
  mediaType: string | null;
}

// Extraction results keyed by the base64 of the submitted front photo.
export const EXTRACTIONS: { frontImage: string; result: ExtractedItem }[] = [
  {
    // A book with a hyphenated ISBN-13.
    frontImage: IMAGES.yellow,
    result: {
      isbn: '978-3-440-15359-8',
      title: 'Die drei ??? Kids - Diebe im Tierpark',
      author: 'Anne Scheller',
      mediaType: 'BOOK',
    },
  },
  {
    // A CD labelled with an ISBN-10 only.
    frontImage: IMAGES.blue,
    result: {
      isbn: '4257178299',
      title: 'Kei Angscht vor em Hotzeplotz',
      author: 'Otfried Preussler',
      mediaType: 'CD',
    },
  },
  {
    // A DVD with an ISBN-13.
    frontImage: IMAGES.purple,
    result: {
      isbn: '978-3-16-148410-0',
      title: 'Die Sendung mit der Maus',
      author: 'Armin Maiwald',
      mediaType: 'DVD',
    },
  },
  {
    // Photos where no ISBN is readable.
    frontImage: IMAGES.red,
    result: {
      isbn: null,
      title: 'Some item',
      author: null,
      mediaType: 'BOOK',
    },
  },
];

// The "cleaned cover" the image edit endpoint returns.
export const GENERATED_COVER = IMAGES.green;
