export type ContactKind = 'phone' | 'email' | 'link';

const TAGS = /<[^>]*>/g;
const EMAIL = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i;
const LINK = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|in|net|org|co|info|biz|io|me)\b/i;
const SEPARATORS = new Set([' ', '\t', '\n', '.', '-', '(', ')', '+']);

/**
 * The first kind of contact detail in `text`, or null. Rich text is read as plain text first,
 * so `<b>98150</b> 12345` is caught. A phone is any run of 10 or more digits with at most two
 * spaces, dots, dashes or brackets between digits (covers +91 and 0 prefixes). Disguised forms
 * ("nine eight one…") are left to staff review.
 */
export function findContactDetails(text: string): ContactKind | null {
  const plain = text.replace(TAGS, ' ');
  if (EMAIL.test(plain)) return 'email';
  if (LINK.test(plain)) return 'link';
  if (hasPhone(plain)) return 'phone';
  return null;
}

/** A run of 10 or more digits with at most two separators between neighbouring digits. */
function hasPhone(text: string): boolean {
  let digits = 0;
  let gap = 0;
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      digits += 1;
      gap = 0;
      if (digits >= 10) return true;
    } else if (SEPARATORS.has(char) && gap < 2) {
      gap += 1;
    } else {
      digits = 0;
      gap = 0;
    }
  }
  return false;
}
