import * as cheerio from 'cheerio';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type EventCategory = 'skating' | 'swimming';
export type EventSubcategory = 'ice_skating' | 'pool' | 'sauna';

export interface ScheduleEvent {
  id: string;
  category: EventCategory;
  subcategory: EventSubcategory;
  title: string;
  subtitle?: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD (Europe/Prague)
  startTime: string; // HH:mm (Europe/Prague)
  endTime: string; // HH:mm (Europe/Prague)
  startIso: string; // ISO-8601 timestamp
  endIso: string; // ISO-8601 timestamp
  note?: string;
  sourceUrl: string;
}

export interface PoolStatus {
  poolTempC: number | null;
  kidsPoolTempC: number | null;
  poolOccupancy: {
    occupied: number;
    capacity: number;
  } | null;
  saunaOccupancy: {
    occupied: number;
    capacity: number;
  } | null;
  sourceUrl: string;
}

export interface EventsPayload {
  lastUpdated: string;
  timezone: 'Europe/Prague';
  poolStatus: PoolStatus;
  events: ScheduleEvent[];
  sources: {
    skating: { url: string; ok: boolean; count: number; error?: string };
    swimming: { url: string; ok: boolean; count: number; error?: string };
    poolStatus: { url: string; ok: boolean; error?: string };
  };
}

const TIMEZONE = 'Europe/Prague';
const USER_AGENT =
  'Mozilla/5.0 (compatible; AkceSvetlaBot/1.0; +https://github.com/akce-svetla)';

// Public sources
const PESINKY_SKATING_URL = 'https://www.pesinky.cz/ap/hledani=1&typ_akce=1075';
const BRODSKA_POOL_URL = 'https://www.brodskasportovni.cz/plavecky-bazen-sauna/';
const ROZPIS_TENANT_ID = '39567125-a950-06ee-676b-2ff66968ac18';
const ROZPIS_API_BASE = 'https://rozpis.eu/api/public/schedule';
const ROZPIS_PUBLIC_URL = `https://rozpis.eu/public/schedule?tenantId=${ROZPIS_TENANT_ID}&resource=999`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, '..', 'data', 'events.json');

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getPragueParts(date: Date): {
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

/**
 * Converts a local Europe/Prague date & time into an exact UTC ISO string,
 * handling CET (+01:00) and CEST (+02:00) transitions accurately.
 */
function pragueLocalToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Start with UTC guess and adjust by Prague offset at that instant
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

function getMondayStartIso(referenceDate = new Date()): string {
  const parts = getPragueParts(referenceDate);
  const todayMidnightUtc = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );
  const daysSinceMonday = parts.weekday - 1;
  todayMidnightUtc.setUTCDate(todayMidnightUtc.getUTCDate() - daysSinceMonday);
  const y = todayMidnightUtc.getUTCFullYear();
  const m = String(todayMidnightUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(todayMidnightUtc.getUTCDate()).padStart(2, '0');
  return pragueLocalToIso(`${y}-${m}-${d}`, '00:00');
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

/**
 * 1) Veřejné bruslení – Zimní stadion Pěšinky, Světlá nad Sázavou
 * Note: hcsvetlans.cz/rozpis-ledu redirects to pesinky.cz, whose official
 * public calendar of skating events (typ_akce=1075) provides structured dates & times.
 */
async function scrapeSvetlaSkating(): Promise<ScheduleEvent[]> {
  const html = await fetchText(PESINKY_SKATING_URL);
  const $ = cheerio.load(html);
  const events: ScheduleEvent[] = [];

  $('#kalendarAkci li.u').each((_, el) => {
    const $item = $(el);
    const $link = $item.find('strong > a').first();
    const rawTitle = $link.text().replace(/\s+/g, ' ').trim();
    const href = $link.attr('href') ?? '';
    const dateBlock = $item.find('.n5-akce-datum').text().replace(/\s+/g, ' ').trim();
    const description = $item.find('.n5-akce-popis').text().replace(/\s+/g, ' ').trim();
    const eventType = $item.find('.n5-akce-typ').text().replace(/\s+/g, ' ').trim();

    const combinedNorm = normalizeText(`${rawTitle} ${eventType} ${description}`);
    if (
      !combinedNorm.includes('verejne brusleni') &&
      !combinedNorm.includes('brusleni verejnosti')
    ) {
      return;
    }

    // Formats observed:
    // "28.11.2026 14:30 - 28.11.2026 16:15, Zimní stadion Pěšinky Světlá nad Sázavou"
    // or "28.11.2026 14:30 - 16:15, ..."
    const fullMatch = dateBlock.match(
      /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}:\d{2})\s*[-–]\s*(?:(\d{1,2})\.(\d{1,2})\.(\d{4})\s+)?(\d{1,2}:\d{2})/
    );
    if (!fullMatch) {
      return;
    }

    const startDay = fullMatch[1].padStart(2, '0');
    const startMonth = fullMatch[2].padStart(2, '0');
    const startYear = fullMatch[3];
    const startTime = fullMatch[4].padStart(5, '0');

    const endDay = (fullMatch[5] ?? fullMatch[1]).padStart(2, '0');
    const endMonth = (fullMatch[6] ?? fullMatch[2]).padStart(2, '0');
    const endYear = fullMatch[7] ?? fullMatch[3];
    const endTime = fullMatch[8].padStart(5, '0');

    const dateStr = `${startYear}-${startMonth}-${startDay}`;
    const endDateStr = `${endYear}-${endMonth}-${endDay}`;
    const sourceUrl = href.startsWith('http')
      ? href
      : `https://www.pesinky.cz${href.startsWith('/') ? '' : '/'}${href}`;

    const venueMatch = dateBlock.split(',').slice(1).join(',').trim();
    const venue = venueMatch || 'Zimní stadion Pěšinky';

    events.push({
      id: `skating-${dateStr}-${startTime.replace(':', '')}-${endTime.replace(':', '')}`,
      category: 'skating',
      subcategory: 'ice_skating',
      title: 'Veřejné bruslení',
      subtitle: rawTitle !== 'Veřejné bruslení' ? rawTitle : undefined,
      venue,
      city: 'Světlá nad Sázavou',
      date: dateStr,
      startTime,
      endTime,
      startIso: pragueLocalToIso(dateStr, startTime),
      endIso: pragueLocalToIso(endDateStr, endTime),
      note: description || undefined,
      sourceUrl,
    });
  });

  return events;
}

interface RozpisResource {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  laneNamesJoined?: string | null;
}

interface RozpisReservation {
  id: string;
  resourceId: string;
  startsAt: string;
  endsAt: string;
  customerName?: string | null;
  displayName?: string | null;
  laneIndex: number;
  laneSpan: number;
  note?: string | null;
}

interface RozpisScheduleResponse {
  resources: RozpisResource[];
  reservations: RozpisReservation[];
  weekPublished?: boolean;
}

/**
 * 2) Plavecký bazén a sauna – Havlíčkův Brod (Brodská sportovní / rozpis.eu API)
 */
async function scrapeHBPoolSchedule(): Promise<ScheduleEvent[]> {
  const mondayIso = getMondayStartIso();
  const fromDate = new Date(mondayIso);
  const toDate = new Date(fromDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  const apiUrl = `${ROZPIS_API_BASE}?tenantId=${encodeURIComponent(
    ROZPIS_TENANT_ID
  )}&from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(
    toDate.toISOString()
  )}`;

  const data = await fetchJson<RozpisScheduleResponse>(apiUrl);
  const poolResource =
    data.resources.find((r) => normalizeText(r.name).includes('plavecky bazen')) ??
    data.resources.find((r) => r.sortOrder === 999);

  if (!poolResource) {
    throw new Error('Plavecký bazén resource not found in rozpis.eu response');
  }

  const laneNames = (poolResource.laneNamesJoined ?? 'Bazén|Sauna|Dráha')
    .split('|')
    .map((s) => s.trim());

  const events: ScheduleEvent[] = [];

  for (const res of data.reservations) {
    if (res.resourceId !== poolResource.id) continue;

    const rawLabel = (res.displayName || res.customerName || '').trim();
    const normLabel = normalizeText(rawLabel);
    const laneName = normalizeText(laneNames[res.laneIndex] ?? '');

    let subcategory: EventSubcategory | null = null;
    let title = '';
    let subtitle: string | undefined;

    if (laneName.includes('bazen') || res.laneIndex === 0) {
      if (normLabel.includes('verejne plavani') || normLabel.includes('verejn')) {
        subcategory = 'pool';
        title = 'Veřejné plavání';
      }
    } else if (laneName.includes('sauna') || res.laneIndex === 1) {
      const isPublicSauna =
        normLabel.includes('muzi') ||
        normLabel.includes('zeny') ||
        normLabel.includes('spolecn') ||
        normLabel.includes('verejn') ||
        normLabel.includes('sauna');
      const isClosedOrPrivate =
        normLabel.includes('zavren') ||
        normLabel.includes('uklid') ||
        normLabel.includes('najem');

      if (isPublicSauna && !isClosedOrPrivate) {
        subcategory = 'sauna';
        title = `Sauna (${rawLabel})`;
        subtitle = 'Finská sauna – Havlíčkův Brod';
      }
    }

    if (!subcategory) continue;

    const startDate = new Date(res.startsAt);
    const endDate = new Date(res.endsAt);
    const startPrague = getPragueParts(startDate);
    const endPrague = getPragueParts(endDate);

    const dateStr = `${startPrague.year}-${startPrague.month}-${startPrague.day}`;
    const startTime = `${startPrague.hour}:${startPrague.minute}`;
    const endTime = `${endPrague.hour}:${endPrague.minute}`;

    events.push({
      id: `hb-${subcategory}-${dateStr}-${startTime.replace(':', '')}-${endTime.replace(':', '')}`,
      category: 'swimming',
      subcategory,
      title,
      subtitle,
      venue: 'Plavecký bazén Kotlina',
      city: 'Havlíčkův Brod',
      date: dateStr,
      startTime,
      endTime,
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      note: res.note?.trim() ? res.note.trim() : undefined,
      sourceUrl: ROZPIS_PUBLIC_URL,
    });
  }

  return events;
}

function parseCzechNumber(text: string): number | null {
  const m = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const val = Number(m[0]);
  return Number.isFinite(val) ? val : null;
}

/**
 * 3) Aktuální obsazenost a teplota vody – brodskasportovni.cz/plavecky-bazen-sauna/
 */
async function scrapeHBPoolStatus(): Promise<PoolStatus> {
  const html = await fetchText(BRODSKA_POOL_URL);
  const $ = cheerio.load(html);

  let poolTempC: number | null = null;
  let kidsPoolTempC: number | null = null;
  let poolOccupancy: { occupied: number; capacity: number } | null = null;
  let saunaOccupancy: { occupied: number; capacity: number } | null = null;

  $('.navstevnost table').each((_, table) => {
    const $table = $(table);
    const tableText = normalizeText($table.text());

    // Water temperatures table
    if (tableText.includes('plavecky bazen') || tableText.includes('detsky bazenek')) {
      $table.find('tr').each((__, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 2) return;
        const label = normalizeText($(tds[0]).text());
        const value = parseCzechNumber($(tds[1]).text());
        if (label.includes('plavecky bazen') && value !== null) {
          poolTempC = value;
        } else if (label.includes('detsky') && value !== null) {
          kidsPoolTempC = value;
        }
      });
      return;
    }

    // Occupancy tables (Bazén / Sauna)
    const header = normalizeText($table.find('td.nazev').first().text());
    if (header === 'bazen' || header === 'sauna') {
      let capacity: number | null = null;
      let occupied: number | null = null;

      $table.find('tr').each((__, tr) => {
        const tds = $(tr).find('td');
        if (tds.length < 2) return;
        const label = normalizeText($(tds[0]).text());
        const value = parseCzechNumber($(tds[1]).text());
        if (label.includes('kapacita') && value !== null) {
          capacity = value;
        } else if (label.includes('obsazeno') && value !== null) {
          occupied = value;
        }
      });

      if (capacity !== null && occupied !== null) {
        if (header === 'bazen') {
          poolOccupancy = { occupied, capacity };
        } else if (header === 'sauna') {
          saunaOccupancy = { occupied, capacity };
        }
      }
    }
  });

  return {
    poolTempC,
    kidsPoolTempC,
    poolOccupancy,
    saunaOccupancy,
    sourceUrl: BRODSKA_POOL_URL,
  };
}

function deduplicateAndSort(events: ScheduleEvent[]): ScheduleEvent[] {
  const byId = new Map<string, ScheduleEvent>();
  for (const ev of events) {
    byId.set(ev.id, ev);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.startIso.localeCompare(b.startIso) || a.title.localeCompare(b.title, 'cs')
  );
}

async function main() {
  const forceWrite = process.argv.includes('--force');

  let skatingEvents: ScheduleEvent[] = [];
  let swimmingEvents: ScheduleEvent[] = [];
  let poolStatus: PoolStatus = {
    poolTempC: null,
    kidsPoolTempC: null,
    poolOccupancy: null,
    saunaOccupancy: null,
    sourceUrl: BRODSKA_POOL_URL,
  };

  const sources: EventsPayload['sources'] = {
    skating: { url: PESINKY_SKATING_URL, ok: false, count: 0 },
    swimming: { url: ROZPIS_PUBLIC_URL, ok: false, count: 0 },
    poolStatus: { url: BRODSKA_POOL_URL, ok: false },
  };

  try {
    skatingEvents = await scrapeSvetlaSkating();
    sources.skating = {
      url: PESINKY_SKATING_URL,
      ok: true,
      count: skatingEvents.length,
    };
    console.log(`[Světlá bruslení] Načteno ${skatingEvents.length} termínů.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sources.skating.error = msg;
    console.error(`[Světlá bruslení] Chyba: ${msg}`);
  }

  try {
    swimmingEvents = await scrapeHBPoolSchedule();
    sources.swimming = {
      url: ROZPIS_PUBLIC_URL,
      ok: true,
      count: swimmingEvents.length,
    };
    console.log(`[HB bazén/sauna] Načteno ${swimmingEvents.length} termínů.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sources.swimming.error = msg;
    console.error(`[HB bazén/sauna] Chyba: ${msg}`);
  }

  try {
    poolStatus = await scrapeHBPoolStatus();
    sources.poolStatus = { url: BRODSKA_POOL_URL, ok: true };
    console.log(
      `[HB stav bazénu] Teplota: ${poolStatus.poolTempC ?? '?'} °C (dětský ${
        poolStatus.kidsPoolTempC ?? '?'
      } °C), bazén ${poolStatus.poolOccupancy?.occupied ?? '?'}/${
        poolStatus.poolOccupancy?.capacity ?? '?'
      }, sauna ${poolStatus.saunaOccupancy?.occupied ?? '?'}/${
        poolStatus.saunaOccupancy?.capacity ?? '?'
      }`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sources.poolStatus.error = msg;
    console.error(`[HB stav bazénu] Chyba: ${msg}`);
  }

  if (!sources.skating.ok && !sources.swimming.ok) {
    throw new Error('Nepodařilo se stáhnout data ani z jednoho hlavního zdroje.');
  }

  const allEvents = deduplicateAndSort([...skatingEvents, ...swimmingEvents]);

  const payload: EventsPayload = {
    lastUpdated: new Date().toISOString(),
    timezone: TIMEZONE,
    poolStatus,
    events: allEvents,
    sources,
  };

  // Skip rewriting if data hasn't changed (prevents noisy GitHub Actions commits)
  if (!forceWrite && existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) as EventsPayload;
      const comparableExisting = JSON.stringify({
        poolStatus: existing.poolStatus,
        events: existing.events,
      });
      const comparableNew = JSON.stringify({
        poolStatus: payload.poolStatus,
        events: payload.events,
      });
      if (comparableExisting === comparableNew) {
        console.log('Rozpis ani stav bazénu se nezměnily – data/events.json zůstává beze změny.');
        return;
      }
    } catch {
      // Ignore invalid previous JSON and overwrite
    }
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log(`Uloženo ${allEvents.length} událostí do ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatální chyba scraperu:', err);
  process.exit(1);
});
