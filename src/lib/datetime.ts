export const BOGOTA_TIME_ZONE = 'America/Bogota';

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDateTimeInBogota(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '';

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
