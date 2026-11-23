import { ScheduleEvent } from './types.js';

export const TIMEZONE = 'Europe/Prague';
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function getPragueParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: number; // 1 = Mon .. 7 = Sun
} {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === '24' ? '00' : parts.hour,
    minute: parts.minute,
    weekday: weekdayMap[parts.weekday] ?? 1,
  };
}

export function getPragueTodayKey(now = new Date()): string {
  const p = getPragueParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Converts a local Europe/Prague YYYY-MM-DD + HH:mm into exact UTC ISO string.
 */
export function pragueLocalToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const pragueAtGuess = getPragueParts(utcGuess);
  const guessAsUtc = Date.UTC(
    Number(pragueAtGuess.year),
    Number(pragueAtGuess.month) - 1,
    Number(pragueAtGuess.day),
    Number(pragueAtGuess.hour),
    Number(pragueAtGuess.minute),
    0
  );
  const offsetMs = guessAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

export function addMinutesToIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function getMondayDateKey(referenceDate = new Date()): string {
  const parts = getPragueParts(referenceDate);
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  return addDaysToKey(todayKey, -(parts.weekday - 1));
}

export function getMondayStartIso(referenceDate = new Date()): string {
  return pragueLocalToIso(getMondayDateKey(referenceDate), '00:00');
}

const CZECH_MONTHS: Record<string, number> = {
  leden: 1,
  ledna: 1,
  unor: 2,
  unora: 2,
  brezen: 3,
  brezna: 3,
  duben: 4,
  dubna: 4,
  kveten: 5,
  kvetna: 5,
  cerven: 6,
  cervna: 6,
  cervenec: 7,
  cervence: 7,
  srpen: 8,
  srpna: 8,
  zari: 9,
  rijen: 10,
  rijna: 10,
  listopad: 11,
  listopadu: 11,
  prosinec: 12,
  prosince: 12,
};

/**
 * Parses Czech date strings like "24. listopadu 2026", "25. 11. 2026", "25.11."
 */
export function parseCzechDate(
  raw: string,
  referenceDate = new Date()
): string | null {
  const norm = normalizeText(raw);

  // 1) "24. listopadu 2026" or "24. listopadu"
  const monthWordMatch = norm.match(
    /(\d{1,2})\.\s*([a-z]+)(?:\s+(\d{4}))?/
  );
  if (monthWordMatch) {
    const monthNum = CZECH_MONTHS[monthWordMatch[2]];
    if (monthNum) {
      const day = Number(monthWordMatch[1]);
      const year = monthWordMatch[3]
        ? Number(monthWordMatch[3])
        : inferYearForMonth(monthNum, referenceDate);
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2) "25. 11. 2026" or "25.11."
  const numericMatch = norm.match(
    /(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/
  );
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const monthNum = Number(numericMatch[2]);
    if (monthNum >= 1 && monthNum <= 12 && day >= 1 && day <= 31) {
      const year = numericMatch[3]
        ? Number(numericMatch[3])
        : inferYearForMonth(monthNum, referenceDate);
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

export function inferYearForMonth(month: number, referenceDate = new Date()): number {
  const parts = getPragueParts(referenceDate);
  const currentYear = Number(parts.year);
  const currentMonth = Number(parts.month);
  // If we're in Nov/Dec and the event month is Jan/Feb/Mar, it's next year
  if (currentMonth >= 10 && month <= 3) {
    return currentYear + 1;
  }
  return currentYear;
}

export function normalizeTime(raw: string): string | null {
  // Always prefer explicit HH:MM (colon) so Czech dates like "25.11." are never mistaken for times
  const colonMatch = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (colonMatch) {
    const hh = Number(colonMatch[1]);
    const mm = Number(colonMatch[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  // Only fall back to HH.MM when NOT immediately followed by another dot (like "25.11.")
  const dotMatch = raw.match(/\b(\d{1,2})\.(\d{2})(?!\.)\b/);
  if (dotMatch) {
    const hh = Number(dotMatch[1]);
    const mm = Number(dotMatch[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  return null;
}

export function resolveAbsoluteUrl(href: string | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) {
    return undefined;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.5',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

export async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'application/json',
      'Accept-Language': 'cs-CZ,cs;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

/**
 * Filters events to keep current week (from Monday) through +35 days ahead.
 */
export function filterWindowEvents(
  events: ScheduleEvent[],
  now = new Date()
): ScheduleEvent[] {
  const minDate = getMondayDateKey(now);
  const maxDate = addDaysToKey(getPragueTodayKey(now), 35);
  return events.filter((e) => e.date >= minDate && e.date <= maxDate);
}
