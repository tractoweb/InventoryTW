export const BOGOTA_TIME_ZONE = 'America/Bogota';

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

function isDateOnlyString(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input.trim());
}

function looksLikeDateOnlyBogotaMidnightMarker(input: string): boolean {
  const s = input.trim();
  // Common patterns produced when storing a date-only value as an ISO instant:
  // - UTC midnight (00:00Z)
  // - Bogotá midnight represented in UTC (05:00Z)
  // Accept variants without a trailing 'Z' and with explicit offsets.
  // Examples:
  // - 2026-02-02T00:00:00
  // - 2026-02-02T00:00:00.000
  // - 2026-02-02T00:00:00Z
  // - 2026-02-02T00:00:00.000-05:00
  return (
    /T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(s) ||
    /T05:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(s)
  );
}

function isBogotaMidnight(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;

  // Determine the time components *in Bogotá*.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOGOTA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  return map.hour === '00' && map.minute === '00' && map.second === '00';
}

function stripTimeOptions(
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions | undefined {
  if (!options) return options;
  const { hour, minute, second, hour12, ...rest } = options;
  return rest;
}

export function formatDateTimeInBogota(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  // If the source is date-only (YYYY-MM-DD) or a synthesized midnight marker,
  // showing 00:00:00 is misleading. In those cases, render date-only.
  if (typeof input === 'string') {
    const raw = input;
    if (isDateOnlyString(raw) || looksLikeDateOnlyBogotaMidnightMarker(raw)) {
      return formatDateInBogota(raw, stripTimeOptions(options));
    }
  }

  // If the value resolves to midnight in Bogotá, it's almost always a date-only value
  // serialized as a datetime. Render date-only to avoid misleading 00:00.
  // (This also affects events that truly happened at midnight, which is acceptable here.)
  if (input instanceof Date) {
    if (isBogotaMidnight(input)) return formatDateInBogota(input, stripTimeOptions(options));
  } else if (typeof input === 'number') {
    const d = new Date(input);
    if (isBogotaMidnight(d)) return formatDateInBogota(d, stripTimeOptions(options));
  }

  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '';

  if (isBogotaMidnight(date)) {
    return formatDateInBogota(date, stripTimeOptions(options));
  }

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}

export function formatDateInBogota(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(date);
}

export function getBogotaYearMonth(now: Date = new Date()): { year: number; month: number } {
  // Use formatToParts so we don't depend on server locale/time zone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);

  return {
    year: Number.isFinite(year) ? year : now.getUTCFullYear(),
    month: Number.isFinite(month) ? month : now.getUTCMonth() + 1,
  };
}

export function ymdToBogotaMidnightUtc(ymd: string): Date {
  // Colombia (Bogotá) is UTC-5 all year (no DST).
  // So 00:00:00 in Bogotá == 05:00:00Z.
  // This avoids server-local timezone affecting the stored instant.
  const iso = `${ymd}T05:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha inválida (YYYY-MM-DD): ${ymd}`);
  }
  return d;
}

export function ymdToBogotaEndOfDayUtc(ymd: string): Date {
  const start = ymdToBogotaMidnightUtc(ymd);
  // End of Bogotá day == start + 24h - 1ms.
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function formatTimeInBogota(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}
