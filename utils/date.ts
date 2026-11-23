import { ScheduleEvent } from '../types/events';

const CZECH_DAYS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
const CZECH_DAYS_FULL = [
  'Pondělí',
  'Úterý',
  'Středa',
  'Čtvrtek',
  'Pátek',
  'Sobota',
  'Neděle',
] as const;

export interface WeekDayItem {
  dateKey: string; // YYYY-MM-DD
  shortLabel: string; // Po..Ne
  fullLabel: string; // Pondělí..Neděle
  dayNumber: number;
  monthNumber: number;
  isToday: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Returns local date key YYYY-MM-DD (uses Europe/Prague if Intl timezone is available,
 * otherwise falls back to device local date).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formatted = formatter.format(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback to device local time on engines without ICU timezone data
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Returns Monday-based weekday index: 0 = Monday .. 6 = Sunday.
 */
export function getWeekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function getWeekDays(weekOffset: number = 0, now: Date = new Date()): WeekDayItem[] {
  const todayKey = getLocalDateKey(now);
  const todayWeekday = getWeekdayIndex(todayKey);
  const mondayKey = addDays(todayKey, -todayWeekday + weekOffset * 7);

  return Array.from({ length: 7 }, (_, idx) => {
    const key = addDays(mondayKey, idx);
    const [, m, d] = key.split('-').map(Number);
    return {
      dateKey: key,
      shortLabel: CZECH_DAYS_SHORT[idx],
      fullLabel: CZECH_DAYS_FULL[idx],
      dayNumber: d,
      monthNumber: m,
      isToday: key === todayKey,
    };
  });
}

export function formatCzechDateHeading(dateKey: string): string {
  const idx = getWeekdayIndex(dateKey);
  const [, m, d] = dateKey.split('-').map(Number);
  return `${CZECH_DAYS_FULL[idx]} ${d}. ${m}.`;
}

export function formatShortCzechDate(dateKey: string): string {
  const idx = getWeekdayIndex(dateKey);
  const [, m, d] = dateKey.split('-').map(Number);
  return `${CZECH_DAYS_SHORT[idx]} ${d}. ${m}.`;
}

export function isEventHappeningNow(event: ScheduleEvent, nowMs: number): boolean {
  const start = Date.parse(event.startIso);
  const end = Date.parse(event.endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return nowMs >= start && nowMs < end;
}

export function isEventPast(event: ScheduleEvent, nowMs: number): boolean {
  const end = Date.parse(event.endIso);
  if (Number.isNaN(end)) return false;
  return nowMs >= end;
}

export function getMinutesUntilStart(event: ScheduleEvent, nowMs: number): number | null {
  const start = Date.parse(event.startIso);
  if (Number.isNaN(start)) return null;
  const diffMin = Math.ceil((start - nowMs) / 60000);
  return diffMin > 0 ? diffMin : null;
}

export function formatLastUpdated(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return 'Neznámý čas';
  try {
    return new Intl.DateTimeFormat('cs-CZ', {
      timeZone: 'Europe/Prague',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt);
  } catch {
    return `${dt.getDate()}. ${dt.getMonth() + 1}. ${dt.getFullYear()} ${pad2(
      dt.getHours()
    )}:${pad2(dt.getMinutes())}`;
  }
}
