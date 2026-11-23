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

export const LEDECSKO_EVENTS_URL = 'https://www.ledecsko.cz/events/';
export const LEDECSKO_AKCE_URL = 'https://www.ledecsko.cz/akce/';

interface JsonLdEvent {
  '@type'?: string;
  name?: string;
  description?: string;
  image?: string | { url?: string };
  url?: string;
  startDate?: string;
  endDate?: string;
  location?: { name?: string };
}

function classifyLedecEvent(title: string, venue: string): {
  category: 'sport' | 'cinema' | 'culture';
  subcategory: 'movie' | 'concert' | 'theatre' | 'exhibition' | 'event';
} {
  const norm = normalizeText(`${title} ${venue}`);
  if (norm.includes('kino') || norm.includes('promitani') || norm.includes('film')) {
    return { category: 'cinema', subcategory: 'movie' };
  }
  if (
    norm.includes('plavani') ||
    norm.includes('trenink') ||
    norm.includes('sport') ||
    norm.includes('turnaj') ||
    norm.includes('beh') ||
    norm.includes('brusleni')
  ) {
    return { category: 'sport', subcategory: 'event' };
  }
  if (norm.includes('vystava') || norm.includes('galerie')) {
    return { category: 'culture', subcategory: 'exhibition' };
  }
  if (norm.includes('koncert') || norm.includes('hudb')) {
    return { category: 'culture', subcategory: 'concert' };
  }
  if (norm.includes('divadl')) {
    return { category: 'culture', subcategory: 'theatre' };
  }
  return { category: 'culture', subcategory: 'event' };
}

/**
 * Ledeč nad Sázavou – oficiální kalendář Ledečsko.cz (JSON-LD na /events/ + fallback HTML /akce/)
 */
export async function scrapeLedecEvents(): Promise<ScheduleEvent[]> {
  const html = await fetchText(LEDECSKO_EVENTS_URL);
  const $ = cheerio.load(html);
  const todayKey = getPragueTodayKey();
  const events: ScheduleEvent[] = [];

  // 1) Parse Schema.org JSON-LD blocks (very clean structured events)
  $('script[type="application/ld+json"]').each((_, scriptEl) => {
    const raw = $(scriptEl).contents().text().trim();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const items: JsonLdEvent[] = Array.isArray(parsed)
      ? (parsed as JsonLdEvent[])
      : [parsed as JsonLdEvent];

    for (const item of items) {
      if (item['@type'] !== 'Event' || !item.name || !item.startDate) continue;

      const title = cleanText(cheerio.load(`<span>${item.name}</span>`)('span').text());
      if (!title) continue;

      const startDt = new Date(item.startDate);
      if (Number.isNaN(startDt.getTime())) continue;

      const endDt = item.endDate ? new Date(item.endDate) : null;
      const startPrague = getPragueParts(startDt);
      const startDateKey = `${startPrague.year}-${startPrague.month}-${startPrague.day}`;
      const startTime = `${startPrague.hour}:${startPrague.minute}`;

      let effectiveDate = startDateKey;
      let endTime: string | undefined;
      let rangeSubtitle: string | undefined;

      if (endDt && !Number.isNaN(endDt.getTime())) {
        const endPrague = getPragueParts(endDt);
        const endDateKey = `${endPrague.year}-${endPrague.month}-${endPrague.day}`;

        if (endDateKey === startDateKey) {
          const et = `${endPrague.hour}:${endPrague.minute}`;
          if (et !== startTime) endTime = et;
        } else {
          // Multi-day event/exhibition: if currently ongoing, show on today
          if (startDateKey < todayKey && endDateKey >= todayKey) {
            effectiveDate = todayKey;
          }
          rangeSubtitle = `Probíhá do ${Number(endPrague.day)}. ${Number(endPrague.month)}.`;
        }
      }

      const venue = cleanText(item.location?.name || 'Ledeč nad Sázavou');
      const { category, subcategory } = classifyLedecEvent(title, venue);

      const imageUrl =
        typeof item.image === 'string'
          ? item.image
          : item.image?.url || undefined;
      const url = item.url || LEDECSKO_EVENTS_URL;

      const startIso = pragueLocalToIso(effectiveDate, startTime);
      const endIso = endTime
        ? pragueLocalToIso(effectiveDate, endTime)
        : addMinutesToIso(startIso, 120);

      const descClean = item.description
        ? cleanText(cheerio.load(`<div>${item.description}</div>`)('div').text()).slice(0, 140)
        : '';

      events.push({
        id: `ledec-${effectiveDate}-${startTime.replace(':', '')}-${slugify(title)}`,
        category,
        subcategory,
        city: 'ledec',
        cityName: CITY_NAMES.ledec,
        venue,
        title,
        subtitle: rangeSubtitle || (descClean || undefined),
        date: effectiveDate,
        startTime,
        endTime,
        startIso,
        endIso,
        url,
        sourceUrl: url,
        imageUrl,
      });
    }
  });

  if (events.length > 0) {
    return events;
  }

  // 2) Fallback: parse HTML cards on ledecsko.cz/akce/
  const fallbackHtml = await fetchText(LEDECSKO_AKCE_URL);
  const $fb = cheerio.load(fallbackHtml);

  $fb('.decm-events-details').each((_, el) => {
    const $el = $fb(el);
    const $link = $el.find('h2.entry-title.title1 a').first();
    const title = cleanText($link.text());
    if (!title) return;

    const dateText = cleanText($el.find('.decm_date').text());
    const timeText = cleanText($el.find('.decm_time').text());
    const venue = cleanText($el.find('.decm_venue').text()) || 'Ledeč nad Sázavou';

    const dateParts = dateText.split(/\s*[-–]\s*/);
    const startDateKey = parseCzechDate(dateParts[0] ?? '');
    const endDateKey = dateParts[1] ? parseCzechDate(dateParts[1]) : null;
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

    const startTime = normalizeTime(timeText) ?? '09:00';
    const url = resolveAbsoluteUrl($link.attr('href'), LEDECSKO_AKCE_URL) ?? LEDECSKO_AKCE_URL;
    const { category, subcategory } = classifyLedecEvent(title, venue);
    const startIso = pragueLocalToIso(effectiveDate, startTime);

    events.push({
      id: `ledec-${effectiveDate}-${startTime.replace(':', '')}-${slugify(title)}`,
      category,
      subcategory,
      city: 'ledec',
      cityName: CITY_NAMES.ledec,
      venue,
      title,
      subtitle: rangeSubtitle,
      date: effectiveDate,
      startTime,
      startIso,
      endIso: addMinutesToIso(startIso, 120),
      url,
      sourceUrl: url,
    });
  });

  return events;
}
