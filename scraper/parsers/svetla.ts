import * as cheerio from 'cheerio';
import { CITY_NAMES, ScheduleEvent } from '../types.js';
import {
  addMinutesToIso,
  cleanText,
  fetchText,
  getPragueParts,
  getPragueTodayKey,
  normalizeText,
  normalizeTime,
  parseCzechDate,
  pragueLocalToIso,
  resolveAbsoluteUrl,
  slugify,
} from '../utils.js';

export const PESINKY_SKATING_URL = 'https://www.pesinky.cz/';
export const KYTICE_URL = 'https://kyticesvetla.cz/kultura';
export const SVETLANS_KALENDAR_URL = 'https://www.svetlans.cz/kalendar-udalosti';

/**
 * 1) Veřejné bruslení – Zimní stadion Pěšinky, Světlá nad Sázavou (nový Vismo6 web pesinky.cz)
 */
export async function scrapeSvetlaSkating(): Promise<ScheduleEvent[]> {
  const homeHtml = await fetchText(PESINKY_SKATING_URL);
  const $home = cheerio.load(homeHtml);

  const detailLinks: { url: string; fallbackDate?: string; title: string; imageUrl?: string }[] = [];
  const seenUrls = new Set<string>();

  $home('article.homepage-event').each((_, el) => {
    const $el = $home(el);
    const title = cleanText($el.find('.homepage-event__title').text());
    const normTitle = normalizeText(title);
    if (
      !normTitle.includes('verejne brusleni') &&
      !normTitle.includes('brusleni verejnosti')
    ) {
      return;
    }

    const href = $el.find('a.homepage-event__link').attr('href');
    const url = resolveAbsoluteUrl(href, PESINKY_SKATING_URL);
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);

    const fallbackDate = $el.find('.homepage-event__date').attr('data-dateFrom') ?? undefined;
    const imgSrc = $el.find('.homepage-event__image img').attr('src');
    const imageUrl = resolveAbsoluteUrl(imgSrc, PESINKY_SKATING_URL);

    detailLinks.push({ url, fallbackDate, title, imageUrl });
  });

  if (detailLinks.length === 0) {
    return [];
  }

  const detailResults = await Promise.allSettled(
    detailLinks.map(async (item) => {
      const detailHtml = await fetchText(item.url, 12000);
      const $d = cheerio.load(detailHtml);
      const found: ScheduleEvent[] = [];

      const imgSrc = $d('.article__image img').attr('src');
      const imageUrl = resolveAbsoluteUrl(imgSrc, item.url) ?? item.imageUrl;
      const perex = cleanText($d('.article-event__perex').text());

      $d('.event-datetime').each((__, dtEl) => {
        const $dt = $d(dtEl);
        const dtText = cleanText($dt.text());
        const isoAttr = $dt.find('time').attr('datetime') ?? '';

        let dateKey: string | null = null;
        const isoMatch = isoAttr.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) {
          dateKey = isoMatch[1];
        } else {
          dateKey = parseCzechDate(dtText) ?? item.fallbackDate ?? null;
        }
        if (!dateKey) return;

        // Extract times e.g. "28. 11. 2026 v 14:30 až 16:30"
        const times = dtText.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
        const startTime =
          (times[0] ? normalizeTime(times[0]) : null) ??
          (isoAttr.match(/T(\d{2}:\d{2})/)?.[1] ?? '14:00');
        const endTime = times[1] ? (normalizeTime(times[1]) ?? undefined) : undefined;

        const startIso = pragueLocalToIso(dateKey, startTime);
        const endIso = endTime
          ? pragueLocalToIso(dateKey, endTime)
          : addMinutesToIso(startIso, 120);

        found.push({
          id: `svetla-skating-${dateKey}-${startTime.replace(':', '')}-${(endTime ?? '0000').replace(':', '')}`,
          category: 'sport',
          subcategory: 'ice_skating',
          city: 'svetla',
          cityName: CITY_NAMES.svetla,
          venue: 'Zimní stadion Pěšinky',
          title: 'Veřejné bruslení',
          subtitle: item.title !== 'Veřejné bruslení' ? item.title : undefined,
          date: dateKey,
          startTime,
          endTime,
          startIso,
          endIso,
          note: perex || undefined,
          url: item.url,
          sourceUrl: item.url,
          imageUrl,
        });
      });

      return found;
    })
  );

  const events: ScheduleEvent[] = [];
  for (const res of detailResults) {
    if (res.status === 'fulfilled') {
      events.push(...res.value);
    }
  }
  return events;
}

interface KyticePerformance {
  id: number;
  ecommerceEventURL?: string | null;
  thirdPartyPurchaseURL?: string | null;
  showId?: number;
  names?: { cs?: string | null; en?: string | null };
  startsAt?: string;
  auditorium?: { id?: number; name?: string | null } | null;
  venue?: { id?: number; name?: string | null } | null;
  versionTranslated?: { cs?: string | null } | null;
  ageClassificationTranslated?: { cs?: string | null } | null;
  marketingLabel?: { name?: string | null } | null;
  show?: {
    id?: number;
    primaryImage?: { url?: string | null } | null;
  } | null;
}

function extractBalancedJsonObject(str: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return str.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

/**
 * 2) KD Kytice / Kivadlo Světlá nad Sázavou (kino + kultura z Attendio/Next.js RSC dat)
 */
export async function scrapeKyticeSvetla(): Promise<ScheduleEvent[]> {
  const html = await fetchText(KYTICE_URL);

  // Extract all Next.js RSC push chunks and unescape JSON string payloads
  const rscRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let combinedPayload = '';
  let match: RegExpExecArray | null;
  while ((match = rscRegex.exec(html)) !== null) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`) as string;
      combinedPayload += '\n' + decoded;
    } catch {
      // Ignore non-JSON chunk
    }
  }

  // Also collect show cover images & taglines by showId
  const showMetaById = new Map<number, { imageUrl?: string; tagline?: string }>();
  const showMarker = /"id":(\d+),"translations":\[\{"title":"/g;
  let sm: RegExpExecArray | null;
  while ((sm = showMarker.exec(combinedPayload)) !== null) {
    const objStart = combinedPayload.lastIndexOf('{', sm.index);
    if (objStart === -1) continue;
    const rawObj = extractBalancedJsonObject(combinedPayload, objStart);
    if (!rawObj) continue;
    try {
      const parsed = JSON.parse(rawObj) as {
        id?: number;
        translations?: { localeCode?: string; tagline?: string }[];
        primaryImage?: { url?: string } | null;
      };
      if (parsed.id) {
        const csTrans = parsed.translations?.find((t) => t.localeCode === 'cs');
        showMetaById.set(parsed.id, {
          imageUrl: parsed.primaryImage?.url ?? undefined,
          tagline: csTrans?.tagline ? cleanText(csTrans.tagline) : undefined,
        });
      }
    } catch {
      // ignore malformed
    }
  }

  // Extract individual performance objects containing "ecommerceEventURL" and "startsAt"
  const events: ScheduleEvent[] = [];
  const seenIds = new Set<number>();
  const perfMarker = /"id":(\d+),"ecommerceEventURL":/g;
  let pm: RegExpExecArray | null;

  while ((pm = perfMarker.exec(combinedPayload)) !== null) {
    const objStart = combinedPayload.lastIndexOf('{', pm.index);
    if (objStart === -1) continue;
    const rawObj = extractBalancedJsonObject(combinedPayload, objStart);
    if (!rawObj) continue;

    let perf: KyticePerformance;
    try {
      perf = JSON.parse(rawObj) as KyticePerformance;
    } catch {
      continue;
    }

    if (!perf.id || seenIds.has(perf.id) || !perf.startsAt) continue;
    seenIds.add(perf.id);

    const title = cleanText(perf.names?.cs || perf.names?.en || '');
    if (!title) continue;

    const startDate = new Date(perf.startsAt);
    if (Number.isNaN(startDate.getTime())) continue;

    const prague = getPragueParts(startDate);
    const dateStr = `${prague.year}-${prague.month}-${prague.day}`;
    const startTime = `${prague.hour}:${prague.minute}`;

    const auditoriumName = cleanText(perf.auditorium?.name ?? '');
    const venueRaw = cleanText(perf.venue?.name ?? '');
    const labelNorm = normalizeText(
      `${auditoriumName} ${perf.marketingLabel?.name ?? ''} ${title}`
    );

    const isCinema =
      normalizeText(auditoriumName).includes('kinosal') ||
      labelNorm.includes('kino') ||
      Boolean(perf.versionTranslated?.cs);

    const venue =
      venueRaw && auditoriumName && venueRaw !== auditoriumName
        ? `KD Kytice (${venueRaw} – ${auditoriumName})`
        : venueRaw
          ? `KD Kytice (${venueRaw})`
          : 'KD Kytice';

    const showMeta = perf.showId ? showMetaById.get(perf.showId) : undefined;
    const imageUrl = perf.show?.primaryImage?.url || showMeta?.imageUrl || undefined;

    const subtitleParts: string[] = [];
    if (perf.versionTranslated?.cs) subtitleParts.push(cleanText(perf.versionTranslated.cs));
    if (perf.marketingLabel?.name) subtitleParts.push(cleanText(perf.marketingLabel.name));
    if (!subtitleParts.length && showMeta?.tagline) {
      subtitleParts.push(showMeta.tagline);
    }

    const detailUrl = perf.showId
      ? `https://kyticesvetla.cz/akce/${perf.showId}`
      : KYTICE_URL;
    const ticketUrl = perf.thirdPartyPurchaseURL || perf.ecommerceEventURL || detailUrl;

    const subcategory = isCinema
      ? 'movie'
      : normalizeText(auditoriumName).includes('divad')
        ? 'theatre'
        : normalizeText(title).includes('koncert')
          ? 'concert'
          : 'event';

    events.push({
      id: `svetla-kytice-${perf.id}`,
      category: isCinema ? 'cinema' : 'culture',
      subcategory,
      city: 'svetla',
      cityName: CITY_NAMES.svetla,
      venue,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
      date: dateStr,
      startTime,
      startIso: startDate.toISOString(),
      endIso: addMinutesToIso(startDate.toISOString(), 120),
      url: ticketUrl,
      sourceUrl: detailUrl,
      imageUrl,
    });
  }

  return events;
}

/**
 * 3) Kalendář událostí města Světlá nad Sázavou (svetlans.cz/kalendar-udalosti)
 */
export async function scrapeSvetlaCityCalendar(): Promise<ScheduleEvent[]> {
  const html = await fetchText(SVETLANS_KALENDAR_URL);
  const $ = cheerio.load(html);
  const todayKey = getPragueTodayKey();
  const events: ScheduleEvent[] = [];

  $('article.event').each((_, el) => {
    const $el = $(el);
    const title = cleanText($el.find('.event__title').text());
    if (!title) return;

    const href = $el.find('.event__link').attr('href');
    const url = resolveAbsoluteUrl(href, SVETLANS_KALENDAR_URL) ?? SVETLANS_KALENDAR_URL;

    const daySpans = $el
      .find('.event__day-fullday')
      .map((__, s) => cleanText($(s).text()))
      .get()
      .filter(Boolean);

    if (!daySpans.length) return;

    const startDateKey = parseCzechDate(daySpans[0]);
    const endDateKey = daySpans[1] ? parseCzechDate(daySpans[1]) : null;
    if (!startDateKey) return;

    // Multi-day ongoing event -> show on today if currently active
    let effectiveDate = startDateKey;
    let rangeNote: string | undefined;
    if (endDateKey && endDateKey > startDateKey) {
      if (startDateKey < todayKey && endDateKey >= todayKey) {
        effectiveDate = todayKey;
      }
      const [, em, ed] = endDateKey.split('-');
      rangeNote = `Probíhá do ${Number(ed)}. ${Number(em)}.`;
    }

    const startTimeRaw = cleanText($el.find('time.event__date.-start').text());
    const endTimeRaw = cleanText($el.find('time.event__date.-end').text());
    const startTime = normalizeTime(startTimeRaw) ?? '09:00';
    const endTime = normalizeTime(endTimeRaw) ?? undefined;

    const types = $el
      .find('.event__type__link')
      .map((__, a) => cleanText($(a).text()))
      .get()
      .filter(Boolean);

    const normAll = normalizeText(`${title} ${types.join(' ')}`);
    const isCinema = normAll.includes('kino');
    const isSport = normAll.includes('sport') || normAll.includes('brusleni');

    const imgSrc = $el.find('.event__image img').attr('src');
    const imageUrl = resolveAbsoluteUrl(imgSrc, SVETLANS_KALENDAR_URL);

    const startIso = pragueLocalToIso(effectiveDate, startTime);
    const endIso = endTime
      ? pragueLocalToIso(effectiveDate, endTime)
      : addMinutesToIso(startIso, 120);

    const subtitleParts = [...types];
    if (rangeNote) subtitleParts.push(rangeNote);

    events.push({
      id: `svetla-mesto-${effectiveDate}-${slugify(title)}`,
      category: isCinema ? 'cinema' : isSport ? 'sport' : 'culture',
      subcategory: isCinema ? 'movie' : isSport ? 'event' : 'event',
      city: 'svetla',
      cityName: CITY_NAMES.svetla,
      venue: 'Světlá nad Sázavou',
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
      date: effectiveDate,
      startTime,
      endTime,
      startIso,
      endIso,
      url,
      sourceUrl: url,
      imageUrl,
    });
  });

  return events;
}
