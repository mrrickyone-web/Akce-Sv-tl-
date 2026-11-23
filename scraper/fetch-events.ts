import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CityId,
  EventsPayload,
  PoolStatus,
  ScheduleEvent,
  SourceReport,
} from './types.js';
import { filterWindowEvents, normalizeText, TIMEZONE } from './utils.js';
import {
  KYTICE_URL,
  PESINKY_SKATING_URL,
  scrapeKyticeSvetla,
  scrapeSvetlaCityCalendar,
  scrapeSvetlaSkating,
  SVETLANS_KALENDAR_URL,
} from './parsers/svetla.js';
import {
  BRODSKA_POOL_URL,
  KDOSTROV_PROGRAM_URL,
  KLUBOKO_PROGRAM_URL,
  MDKO_DIVADLO_URL,
  MDKO_KINO_URL,
  ROZPIS_PUBLIC_URL,
  scrapeHBPoolSchedule,
  scrapeHBPoolStatus,
  scrapeKdOstrov,
  scrapeKlubOko,
  scrapeMdkoDivadlo,
  scrapeMdkoKino,
} from './parsers/hb.js';
import { LEDECSKO_EVENTS_URL, scrapeLedecEvents } from './parsers/ledec.js';
import {
  HUMPOLEC_AKCE_URL,
  HUMPOLEC_KINO_URL,
  scrapeHumpolecAkce,
  scrapeHumpolecKino,
} from './parsers/humpolec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, '..', 'data', 'events.json');

interface EventScraperTask {
  id: string;
  city: CityId;
  label: string;
  url: string;
  run: () => Promise<ScheduleEvent[]>;
}

const EVENT_TASKS: EventScraperTask[] = [
  // Světlá nad Sázavou
  {
    id: 'svetla_skating',
    city: 'svetla',
    label: 'Světlá – Veřejné bruslení (Pěšinky)',
    url: PESINKY_SKATING_URL,
    run: scrapeSvetlaSkating,
  },
  {
    id: 'svetla_kytice',
    city: 'svetla',
    label: 'Světlá – KD Kytice / Kivadlo (kino a kultura)',
    url: KYTICE_URL,
    run: scrapeKyticeSvetla,
  },
  {
    id: 'svetla_mesto',
    city: 'svetla',
    label: 'Světlá – Kalendář města (svetlans.cz)',
    url: SVETLANS_KALENDAR_URL,
    run: scrapeSvetlaCityCalendar,
  },
  // Havlíčkův Brod
  {
    id: 'hb_pool',
    city: 'hb',
    label: 'Havlíčkův Brod – Bazén a sauna Kotlina',
    url: ROZPIS_PUBLIC_URL,
    run: scrapeHBPoolSchedule,
  },
  {
    id: 'hb_mdko_kino',
    city: 'hb',
    label: 'Havlíčkův Brod – Kino Ostrov (MDKO)',
    url: MDKO_KINO_URL,
    run: scrapeMdkoKino,
  },
  {
    id: 'hb_mdko_divadlo',
    city: 'hb',
    label: 'Havlíčkův Brod – Divadlo Ostrov (MDKO)',
    url: MDKO_DIVADLO_URL,
    run: scrapeMdkoDivadlo,
  },
  {
    id: 'hb_kdostrov',
    city: 'hb',
    label: 'Havlíčkův Brod – KD Ostrov',
    url: KDOSTROV_PROGRAM_URL,
    run: scrapeKdOstrov,
  },
  {
    id: 'hb_kluboko',
    city: 'hb',
    label: 'Havlíčkův Brod – Klub Oko',
    url: KLUBOKO_PROGRAM_URL,
    run: scrapeKlubOko,
  },
  // Ledeč nad Sázavou
  {
    id: 'ledec_events',
    city: 'ledec',
    label: 'Ledeč nad Sázavou – Kalendář Ledečsko.cz',
    url: LEDECSKO_EVENTS_URL,
    run: scrapeLedecEvents,
  },
  // Humpolec
  {
    id: 'humpolec_kino',
    city: 'humpolec',
    label: 'Humpolec – Kino Humpolec (MěKIS)',
    url: HUMPOLEC_KINO_URL,
    run: scrapeHumpolecKino,
  },
  {
    id: 'humpolec_akce',
    city: 'humpolec',
    label: 'Humpolec – Kulturní akce (MěKIS)',
    url: HUMPOLEC_AKCE_URL,
    run: scrapeHumpolecAkce,
  },
];

function deduplicateAndSort(events: ScheduleEvent[]): ScheduleEvent[] {
  const bySignature = new Map<string, ScheduleEvent>();

  for (const ev of events) {
    // Semantic key deduplicates same event listed on both city calendar & venue website
    const titleKey = normalizeText(ev.title)
      .replace(/^kino:\s*/i, '')
      .replace(/\s*-\s*dopo kino$/i, '')
      .slice(0, 32);
    const sig = `${ev.city}|${ev.date}|${ev.startTime}|${titleKey}`;

    const existing = bySignature.get(sig);
    if (!existing) {
      bySignature.set(sig, ev);
      continue;
    }

    // Prefer entry with direct ticket link, image, or richer subtitle
    const existingScore =
      (existing.imageUrl ? 2 : 0) +
      (existing.subtitle ? 1 : 0) +
      (existing.url && /entradio|smsticket|disdata|goout/i.test(existing.url) ? 3 : 0);
    const newScore =
      (ev.imageUrl ? 2 : 0) +
      (ev.subtitle ? 1 : 0) +
      (ev.url && /entradio|smsticket|disdata|goout/i.test(ev.url) ? 3 : 0);

    if (newScore > existingScore) {
      bySignature.set(sig, ev);
    }
  }

  return Array.from(bySignature.values()).sort(
    (a, b) =>
      a.startIso.localeCompare(b.startIso) ||
      a.city.localeCompare(b.city) ||
      a.title.localeCompare(b.title, 'cs')
  );
}

async function main() {
  const forceWrite = process.argv.includes('--force');

  // Run all event scrapers + pool status in parallel via Promise.allSettled
  const [eventResults, poolStatusResult] = await Promise.all([
    Promise.allSettled(EVENT_TASKS.map((t) => t.run())),
    Promise.allSettled([scrapeHBPoolStatus()]),
  ]);

  const sources: Record<string, SourceReport> = {};
  const collected: ScheduleEvent[] = [];
  let succeededCount = 0;

  eventResults.forEach((result, idx) => {
    const task = EVENT_TASKS[idx];
    if (result.status === 'fulfilled') {
      const windowed = filterWindowEvents(result.value);
      collected.push(...windowed);
      succeededCount++;
      sources[task.id] = {
        id: task.id,
        city: task.city,
        label: task.label,
        url: task.url,
        ok: true,
        count: windowed.length,
      };
      console.log(`[OK] ${task.label}: ${windowed.length} akcí`);
    } else {
      const msg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      sources[task.id] = {
        id: task.id,
        city: task.city,
        label: task.label,
        url: task.url,
        ok: false,
        count: 0,
        error: msg,
      };
      console.warn(`[CHYBA] ${task.label}: ${msg}`);
    }
  });

  let poolStatus: PoolStatus = {
    poolTempC: null,
    kidsPoolTempC: null,
    poolOccupancy: null,
    saunaOccupancy: null,
    sourceUrl: BRODSKA_POOL_URL,
  };

  const ps = poolStatusResult[0];
  if (ps.status === 'fulfilled') {
    poolStatus = ps.value;
    sources.hb_pool_status = {
      id: 'hb_pool_status',
      city: 'hb',
      label: 'Havlíčkův Brod – Stav a teplota bazénu',
      url: BRODSKA_POOL_URL,
      ok: true,
      count: 1,
    };
    console.log(
      `[OK] HB stav bazénu: ${poolStatus.poolTempC ?? '?'} °C (dětský ${
        poolStatus.kidsPoolTempC ?? '?'
      } °C), bazén ${poolStatus.poolOccupancy?.occupied ?? '?'}/${
        poolStatus.poolOccupancy?.capacity ?? '?'
      }, sauna ${poolStatus.saunaOccupancy?.occupied ?? '?'}/${
        poolStatus.saunaOccupancy?.capacity ?? '?'
      }`
    );
  } else {
    const msg = ps.reason instanceof Error ? ps.reason.message : String(ps.reason);
    sources.hb_pool_status = {
      id: 'hb_pool_status',
      city: 'hb',
      label: 'Havlíčkův Brod – Stav a teplota bazénu',
      url: BRODSKA_POOL_URL,
      ok: false,
      count: 0,
      error: msg,
    };
    console.warn(`[CHYBA] HB stav bazénu: ${msg}`);
  }

  if (succeededCount === 0) {
    throw new Error('Selhaly všechny zdroje dat – data/events.json nebude přepsán.');
  }

  const finalEvents = deduplicateAndSort(collected);

  const payload: EventsPayload = {
    lastUpdated: new Date().toISOString(),
    timezone: TIMEZONE,
    poolStatus,
    events: finalEvents,
    sources,
  };

  // Skip rewriting if data hasn't changed (prevents noisy commits in GitHub Actions)
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
        console.log('Žádná změna v událostech ani stavu bazénu – data/events.json beze změny.');
        return;
      }
    } catch {
      // Ignore parse errors and overwrite
    }
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log(`\nCelkem uloženo ${finalEvents.length} unikátních akcí do ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatální chyba scraperu:', err);
  process.exit(1);
});
