import * as cheerio from 'cheerio';
import { CITY_NAMES, PoolStatus, ScheduleEvent } from '../types.js';
import {
  addMinutesToIso,
  cleanText,
  fetchJson,
  fetchText,
  getMondayStartIso,
  getPragueParts,
  normalizeText,
  normalizeTime,
  parseCzechDate,
  pragueLocalToIso,
  resolveAbsoluteUrl,
  slugify,
} from '../utils.js';

export const BRODSKA_POOL_URL = 'https://www.brodskasportovni.cz/plavecky-bazen-sauna/';
const ROZPIS_TENANT_ID = '39567125-a950-06ee-676b-2ff66968ac18';
const ROZPIS_API_BASE = 'https://rozpis.eu/api/public/schedule';
export const ROZPIS_PUBLIC_URL = `https://rozpis.eu/public/schedule?tenantId=${ROZPIS_TENANT_ID}&resource=999`;

export const MDKO_KINO_URL = 'https://mdko.cz/program-kina/';
export const MDKO_DIVADLO_URL = 'https://mdko.cz/program-divadla/';
export const KDOSTROV_PROGRAM_URL = 'https://www.kdostrov.cz/program';
export const KLUBOKO_PROGRAM_URL = 'https://kluboko.cz/program';

interface RozpisResource {
  id: string;
  name: string;
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
}

/**
 * 1) Plavecký bazén a sauna – Havlíčkův Brod (rozpis.eu JSON API)
 */
export async function scrapeHBPoolSchedule(): Promise<ScheduleEvent[]> {
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

    const rawLabel = cleanText(res.displayName || res.customerName || '');
    const normLabel = normalizeText(rawLabel);
    const laneName = normalizeText(laneNames[res.laneIndex] ?? '');

    let subcategory: 'pool' | 'sauna' | null = null;
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
      category: 'sport',
      subcategory,
      city: 'hb',
      cityName: CITY_NAMES.hb,
      venue: 'Plavecký bazén Kotlina',
      title,
      subtitle,
      date: dateStr,
      startTime,
      endTime,
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      note: res.note?.trim() ? cleanText(res.note) : undefined,
      url: ROZPIS_PUBLIC_URL,
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
 * 2) Teplota vody a aktuální obsazenost – brodskasportovni.cz
 */
export async function scrapeHBPoolStatus(): Promise<PoolStatus> {
  const html = await fetchText(BRODSKA_POOL_URL);
  const $ = cheerio.load(html);

  let poolTempC: number | null = null;
  let kidsPoolTempC: number | null = null;
  let poolOccupancy: { occupied: number; capacity: number } | null = null;
  let saunaOccupancy: { occupied: number; capacity: number } | null = null;

  $('.navstevnost table').each((_, table) => {
    const $table = $(table);
    const tableText = normalizeText($table.text());

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

/**
 * 3) MDKO – Kino Ostrov a Divadlo Ostrov (mdko.cz)
 */
async function scrapeMdkoPage(
  pageUrl: string,
  category: 'cinema' | 'culture',
  venue: string
): Promise<ScheduleEvent[]> {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const events: ScheduleEvent[] = [];

  $('.col-item-content').each((_, contentEl) => {
    const $content = $(contentEl);
    const $card = $content.parent();

    const title = cleanText($content.find('.col-item-heading').text());
    if (!title) return;

    const datetimeText = cleanText($content.find('.col-item-daydatetime').text());
    // Example: "Středa | 25.11. | 17:30"
    const dateKey = parseCzechDate(datetimeText);
    const startTime = normalizeTime(datetimeText);
    if (!dateKey || !startTime) return;

    const genre = cleanText($content.find('.col-item-genre').text());
    const entry = cleanText($content.find('.col-item-entry').text());
    const detailHref =
      $content.attr('href') ||
      $card.find('.col-item-image a').attr('href') ||
      $card.find('.col-buttons a').first().attr('href');
    const detailUrl = resolveAbsoluteUrl(detailHref, pageUrl) ?? pageUrl;

    const ticketHref =
      $card.find('a.vstupenky-mobile').attr('href') ||
      $card.find('a.vstupenky-desktop').attr('href');
    const ticketUrl = resolveAbsoluteUrl(ticketHref, pageUrl) ?? detailUrl;

    const imgSrc = $card.find('.col-item-image img').attr('src');
    const imageUrl = resolveAbsoluteUrl(imgSrc, pageUrl);

    // Try extracting runtime in minutes from entry like "100 min."
    const minMatch = entry.match(/(\d{2,3})\s*min/i);
    const durationMin = minMatch ? Number(minMatch[1]) : 120;

    const startIso = pragueLocalToIso(dateKey, startTime);
    const endIso = addMinutesToIso(startIso, durationMin);

    const subtitleParts = [genre, entry].filter(Boolean);

    events.push({
      id: `hb-mdko-${category}-${dateKey}-${startTime.replace(':', '')}-${slugify(title)}`,
      category,
      subcategory: category === 'cinema' ? 'movie' : 'theatre',
      city: 'hb',
      cityName: CITY_NAMES.hb,
      venue,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
      date: dateKey,
      startTime,
      startIso,
      endIso,
      url: ticketUrl,
      sourceUrl: detailUrl,
      imageUrl,
    });
  });

  return events;
}

export async function scrapeMdkoKino(): Promise<ScheduleEvent[]> {
  return scrapeMdkoPage(MDKO_KINO_URL, 'cinema', 'Kino Ostrov');
}

export async function scrapeMdkoDivadlo(): Promise<ScheduleEvent[]> {
  return scrapeMdkoPage(MDKO_DIVADLO_URL, 'culture', 'Městské divadlo a kino Ostrov');
}

/**
 * 4) Kulturní dům Ostrov (kdostrov.cz/program)
 */
export async function scrapeKdOstrov(): Promise<ScheduleEvent[]> {
  const html = await fetchText(KDOSTROV_PROGRAM_URL);
  const $ = cheerio.load(html);
  const events: ScheduleEvent[] = [];

  $('a[href^="/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') ?? '';
    if (
      !href ||
      href === '/' ||
      href.startsWith('/program') ||
      href.startsWith('/kontakt') ||
      href.startsWith('/o-nas') ||
      href.startsWith('/pronajem') ||
      href.startsWith('/_next')
    ) {
      return;
    }

    const textBlock = $a.find('div.text-lg, div.text-xl').first();
    if (!textBlock.length) return;

    const spans = textBlock
      .find('span')
      .map((__, s) => cleanText($(s).text()))
      .get()
      .filter(Boolean);
    if (spans.length < 2) return;

    const title = spans[0];
    const dateKey = parseCzechDate(spans[1]);
    if (!title || !dateKey) return;

    const startTime = (spans[2] ? normalizeTime(spans[2]) : null) ?? '19:00';
    const badge = cleanText($a.find('.bg-amber-400').first().text());
    const imgAlt = $a.find('img').attr('alt') ?? '';
    const imageUrl = imgAlt.startsWith('http') ? imgAlt : undefined;

    const url = resolveAbsoluteUrl(href, KDOSTROV_PROGRAM_URL) ?? KDOSTROV_PROGRAM_URL;
    const normTag = normalizeText(`${badge} ${title}`);
    const isSport = normTag.includes('stolni tenis') || normTag.includes('sport');
    const isCinema = normTag.includes('kino') || normTag.includes('film');

    const startIso = pragueLocalToIso(dateKey, startTime);

    events.push({
      id: `hb-kdostrov-${dateKey}-${startTime.replace(':', '')}-${slugify(title)}`,
      category: isCinema ? 'cinema' : isSport ? 'sport' : 'culture',
      subcategory: normTag.includes('koncert')
        ? 'concert'
        : normTag.includes('divadl')
          ? 'theatre'
          : 'event',
      city: 'hb',
      cityName: CITY_NAMES.hb,
      venue: 'KD Ostrov',
      title,
      subtitle: badge && badge !== 'Vstupenky' ? badge : undefined,
      date: dateKey,
      startTime,
      startIso,
      endIso: addMinutesToIso(startIso, 150),
      url,
      sourceUrl: url,
      imageUrl,
    });
  });

  return events;
}

/**
 * 5) Klub Oko Havlíčkův Brod (kluboko.cz/program)
 */
export async function scrapeKlubOko(): Promise<ScheduleEvent[]> {
  const html = await fetchText(KLUBOKO_PROGRAM_URL);
  const $ = cheerio.load(html);
  const events: ScheduleEvent[] = [];

  $('.kluboko-program__row').each((_, row) => {
    const $row = $(row);
    const $titleLink = $row.find('.kluboko-program__title a').first();
    const title = cleanText($titleLink.text());
    if (!title) return;

    const datetimeAttr = $row.find('.kluboko-program__date time').attr('datetime') ?? '';
    const dateText = cleanText($row.find('.kluboko-program__date time').text());

    let dateKey: string | null = null;
    const isoMatch = datetimeAttr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      dateKey = isoMatch[1];
    } else {
      // Fallback "27/11"
      const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/);
      if (slashMatch) {
        dateKey = parseCzechDate(`${slashMatch[1]}.${slashMatch[2]}.`);
      }
    }
    if (!dateKey) return;

    const meta = cleanText($row.find('.kluboko-program__meta').text());
    const startTime = normalizeTime(meta) ?? '20:00';
    const price = cleanText($row.find('.kluboko-program__price').text());

    const detailUrl =
      resolveAbsoluteUrl($titleLink.attr('href'), KLUBOKO_PROGRAM_URL) ??
      KLUBOKO_PROGRAM_URL;
    const ticketUrl =
      resolveAbsoluteUrl(
        $row.find('a.kluboko-program__ticket').attr('href'),
        KLUBOKO_PROGRAM_URL
      ) ?? detailUrl;

    const normMeta = normalizeText(`${meta} ${title}`);
    const isCinema = normMeta.includes('film') || normMeta.includes('kino');
    const isConcert = normMeta.includes('koncert') || normMeta.includes('kapela');

    const metaWithoutTime = meta.replace(/·?\s*od\s+\d{1,2}:\d{2}/i, '').trim();
    const subtitleParts = [
      metaWithoutTime,
      price ? `Vstupné: ${price}` : '',
    ].filter(Boolean);

    const startIso = pragueLocalToIso(dateKey, startTime);

    events.push({
      id: `hb-kluboko-${dateKey}-${startTime.replace(':', '')}-${slugify(title)}`,
      category: isCinema ? 'cinema' : 'culture',
      subcategory: isCinema ? 'movie' : isConcert ? 'concert' : 'event',
      city: 'hb',
      cityName: CITY_NAMES.hb,
      venue: 'Klub Oko',
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
      date: dateKey,
      startTime,
      startIso,
      endIso: addMinutesToIso(startIso, 180),
      url: ticketUrl,
      sourceUrl: detailUrl,
    });
  });

  return events;
}
