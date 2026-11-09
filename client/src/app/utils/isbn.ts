/**
 * Mirrors the server-side IsbnValidator: hyphens/spaces are ignored, an
 * ISBN-10 is converted, and the 978/979 prefix and check digit are
 * verified. Returns the normalized ISBN-13, or null when invalid.
 */
export const toIsbn13 = (raw: string): string | null => {
  const digits = raw.replace(/[\s-]/g, '');
  const candidate = /^\d{9}[\dXx]$/.test(digits)
    ? convertIsbn10(digits)
    : digits;

  return /^(978|979)\d{10}$/.test(candidate) && hasValidCheckDigit(candidate)
    ? candidate
    : null;
};

const convertIsbn10 = (isbn10: string): string => {
  const base = `978${isbn10.slice(0, 9)}`;
  return `${base}${checkDigit(base)}`;
};

const hasValidCheckDigit = (isbn13: string): boolean =>
  checkDigit(isbn13.slice(0, 12)) === Number(isbn13[12]);

const checkDigit = (first12Digits: string): number => {
  const sum = [...first12Digits]
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
};
