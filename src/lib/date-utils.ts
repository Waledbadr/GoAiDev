import { format, formatDistanceToNow } from 'date-fns';

/**
 * Universal date parser that safely handles:
 * - Native Date objects (including checking for Invalid Date / NaN)
 * - Firestore Timestamp instances (with .toDate())
 * - Serialized Firestore Timestamps ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
 * - Unix timestamps (in seconds or milliseconds)
 * - ISO date strings and legacy "YYYY-MM-DD HH:mm:ss" strings
 * - Null / undefined / empty string / unexpected objects
 * 
 * Returns a valid Date instance or null (NEVER throws).
 */
export function parseSafeDate(input: unknown): Date | null {
  if (input === null || input === undefined || input === '' || input === false) {
    return null;
  }

  // 1. Already a Date object
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // 2. Firestore Timestamp instance with .toDate()
  if (typeof (input as any).toDate === 'function') {
    try {
      const d = (input as any).toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
      }
    } catch {}
  }

  // 3. Serialized Firestore Timestamp ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
  if (typeof input === 'object' && input !== null) {
    const sec = (input as any).seconds ?? (input as any)._seconds;
    if (typeof sec === 'number' && !isNaN(sec)) {
      const nanos = (input as any).nanoseconds ?? (input as any)._nanoseconds ?? 0;
      const ms = sec * 1000 + Math.floor(nanos / 1_000_000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }

  // 4. Numeric timestamp (seconds vs milliseconds)
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return null;
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return !isNaN(d.getTime()) ? d : null;
  }

  // 5. String parsing
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Numeric timestamp string (e.g. "1729000000" or "1729000000000")
    if (/^\d{9,15}$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        const ms = num < 1e11 ? num * 1000 : num;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Direct Date constructor parse
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d;
    }

    // Replace "YYYY-MM-DD HH:mm:ss" space with "T" for strict ISO parsers
    if (trimmed.includes(' ') && !trimmed.includes('T')) {
      const isoCandidate = trimmed.replace(' ', 'T');
      const dIso = new Date(isoCandidate);
      if (!isNaN(dIso.getTime())) {
        return dIso;
      }
    }
  }

  return null;
}

/**
 * Returns true if the input can be parsed into a valid Date.
 */
export function isValidDate(input: unknown): boolean {
  return parseSafeDate(input) !== null;
}

/**
 * Guarantees a valid Date instance. If the input cannot be parsed, returns fallback (default: new Date()).
 */
export function safeDate(input: unknown, fallback: Date = new Date()): Date {
  const parsed = parseSafeDate(input);
  return parsed ?? fallback;
}

/**
 * Bulletproof date formatter using date-fns.
 * Guaranteed NEVER to throw RangeError: Invalid time value.
 * If input is missing or invalid, returns fallback (default: '-').
 */
export function safeFormat(
  input: unknown,
  formatStr: string,
  options?: Parameters<typeof format>[2],
  fallback: string = '-'
): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  try {
    return format(d, formatStr, options);
  } catch (err) {
    console.warn('[safeFormat] Error formatting date:', err);
    return fallback;
  }
}

/**
 * Bulletproof relative time formatter using date-fns formatDistanceToNow.
 * Guaranteed NEVER to throw RangeError: Invalid time value.
 * If input is missing or invalid, returns fallback (default: '').
 */
export function safeFormatDistanceToNow(
  input: unknown,
  options?: Parameters<typeof formatDistanceToNow>[1],
  fallback: string = ''
): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  try {
    return formatDistanceToNow(d, options);
  } catch (err) {
    console.warn('[safeFormatDistanceToNow] Error formatting relative time:', err);
    return fallback;
  }
}
