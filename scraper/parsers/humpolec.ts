import * as cheerio from 'cheerio';
import { CITY_NAMES, ScheduleEvent } from '../types.js';
import {
  addMinutesToIso,
  cleanText,
  fetchText,
  getPragueTodayKey,
  normalizeText,
  normalizeTime,
  parseCzechDate,
  pragueLocalToIso,
  resolveAbsoluteUrl,
  slugify,
} from '../utils.js';

export const HUMPOLEC_KINO_URL = 'https://humpolec.cz/misto/kino/';
export const HUMPOLEC_AKCE_URL = 'https://humpolec.cz/akce/';

function parseHumpolecArticles(
  html: string,
  pageUrl: string,
  forceCinema: boolean
): ScheduleEvent[] {
  const $ = cheerio.load(html);
  const todayKey = getPragueTodayKey();
  const events: ScheduleEvent[] = [];

  $('article.event').each((_, el) => {
    const $art = $(el);
    const classes = normalizeText($art.attr('class') ?? '');

    const $headingLink = $art
      .find('.headline h1 a, .headline h2 a, .headline h3 a')
      .first();
    const title = cleanText($headingLink.text());
    if (!title) return;

    const detailUrl =
      resolveAbsoluteUrl($headingLink.attr('href'), pageUrl) ?? pageUrl;

    // Calendar date text: can be "25. 11. 2026" or "2. 11. 2026 — 30. 11. 2026" or contain <span class="closest">
    const calendarVal = cleanText($art.find('.fa-calendar .value').text());
    if (!calendarVal) return;

    const rangeParts = calendarVal.split(/\s*[—–-]\s*/);
    const startDateKey = parseCzechDate(rangeParts[0] ?? '');
    const endDateKey = rangeParts[1] ? parseCzechDate(rangeParts[1]) : null;
    if (!startDateKey) return;

    let effectiveDate = startDateKey;
    let rangeSubtitle: string | undefined;
    if (endDateKey && endDateKey > startDateKey) {
      if (startDateKey < todayKey && endDateKey >= todayKey) {
        effectiveDate = todayKey;
      }
      const [, em, ed] = endDateKey.split('-');
      rangeSubtitle = `Probíhá do ${Number(ed)}. ${Number(em)}.`;
    }

    // Time: "od 19:00", "od 13:00 do 17:30", or "17:00"
    const clockVal = cleanText($art.find('.fa-clock .value').text());
    const allTimes = clockVal.match(/\d{1,2}[:.]\d{2}/g) ?? [];
    const startTime = (allTimes[0] ? normalizeTime(allTimes[0]) : null) ?? '18:00';
    const endTime =
      allTimes[1] ? (normalizeTime(allTimes[1]) ?? undefined) : undefined;

    // Price
    const priceVal = cleanText($art.find('.fa-money-bill .value').text());

    // Venue
    const rawVenue = cleanText(
      $art.find('.fa-map-location a, .fa-map-location .value').first().text()
    );
    const venue = rawVenue
      ? rawVenue.split(',')[0].trim()
      : forceCinema
        ? 'Kino Humpolec (MěKIS)'
        : 'MěKIS Humpolec';

    // Ticket link (smsticket / disdata / etc.)
    const ticketHref =
      $art.find('a[href*="smsticket"], a[href*="disdata"], a[href*="goout"]').first().attr('href') ||
      $art
        .find('a')
        .filter((__, a) => normalizeText($(a).text()).includes('vstupen'))
        .first()
        .attr('href');
    const url = resolveAbsoluteUrl(ticketHref, pageUrl) ?? detailUrl;

    // Image (WordPress lazyload uses data-src)
    const $img = $art.find('.picture img').first();
    const rawImg = $img.attr('data-src') || $img.attr('src') || '';
    const imageUrl =
      rawImg && !rawImg.startsWith('data:')
        ? resolveAbsoluteUrl(rawImg, pageUrl)
        : undefined;

    // Category & subcategory
    const isCinema = forceCinema || classes.includes('kino');
    const isSport = classes.includes('sport');
    const category = isCinema ? 'cinema' : isSport ? 'sport' : 'culture';

    const subcategory = isCinema
      ? 'movie'
      : classes.includes('koncert')
        ? 'concert'
        : classes.includes('divadlo') || classes.includes('stand-up')
          ? 'theatre'
          : classes.includes('vystava')
            ? 'exhibition'
            : 'event';

    const subtitleParts: string[] = [];
    if (priceVal) subtitleParts.push(priceVal);
    if (rangeSubtitle) subtitleParts.push(rangeSubtitle);

    const startIso = pragueLocalToIso(effectiveDate, startTime);
    const endIso = endTime
      ? pragueLocalToIso(effectiveDate, endTime)
      : addMinutesToIso(startIso, 120);

    events.push({
      id: `humpolec-${category}-${effectiveDate}-${startTime.replace(':', '')}-${slugify(title)}`,
      category,
      subcategory,
      city: 'humpolec',
      cityName: CITY_NAMES.humpolec,
      venue,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' • ') : undefined,
      date: effectiveDate,
      startTime,
      endTime,
      startIso,
      endIso,
      url,
      sourceUrl: detailUrl,
      imageUrl,
    });
  });

  return events;
}

/**
 * 1) Kino Humpolec (MěKIS – oficiální program na humpolec.cz/misto/kino/)
 */
export async function scrapeHumpolecKino(): Promise<ScheduleEvent[]> {
  const html = await fetchText(HUMPOLEC_KINO_URL);
  return parseHumpolecArticles(html, HUMPOLEC_KINO_URL, true);
}

/**
 * 2) Kulturní a městské akce Humpolec (MěKIS – humpolec.cz/akce/)
 */
export async function scrapeHumpolecAkce(): Promise<ScheduleEvent[]> {
  const html = await fetchText(HUMPOLEC_AKCE_URL);
  return parseHumpolecArticles(html, HUMPOLEC_AKCE_URL, false);
}
