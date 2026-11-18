/**
 * Strips control characters and encodes HTML entities to prevent XSS/HTML injection.
 */
export function sanitizeText(input: string, maxLength: number): string {
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
