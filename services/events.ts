import AsyncStorage from '@react-native-async-storage/async-storage';
import bundledEventsJson from '../data/events.json';
import {
  ALL_CITIES,
  CITY_META,
  CityId,
  DataOrigin,
  EventCategory,
  EventsPayload,
  ScheduleEvent,
} from '../types/events';

/**
 * URL k živému JSON souboru v GitHub repozitáři.
 */
export const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/mrrickyone-web/Akce-Sv-tl-/main/data/events.json';

const STORAGE_KEY = 'akce_svetla_events_cache_v2';
const LEGACY_STORAGE_KEY = 'akce_svetla_events_cache_v1';
const CITIES_PREF_KEY = 'akce_svetla_selected_cities_v1';
const FETCH_TIMEOUT_MS = 10000;

export interface EventsLoadResult {
  payload: EventsPayload;
  origin: DataOrigin;
  error?: string;
}

export function isGitHubUrlConfigured(): boolean {
  return (
    Boolean(GITHUB_RAW_URL) &&
    !GITHUB_RAW_URL.includes('<UZIVATEL>') &&
    !GITHUB_RAW_URL.includes('<REPOZITAR>')
  );
}

function normalizeCity(raw: unknown): CityId {
  if (typeof raw !== 'string') return 'svetla';
  const low = raw.toLowerCase();
  if (low === 'svetla' || low.includes('světl') || low.includes('svetl')) return 'svetla';
  if (low === 'hb' || low.includes('brod')) return 'hb';
  if (low === 'ledec' || low.includes('ledeč') || low.includes('ledec')) return 'ledec';
  if (low === 'humpolec' || low.includes('humpol')) return 'humpolec';
  return 'svetla';
}

function normalizeCategory(raw: unknown): EventCategory {
  if (raw === 'cinema' || raw === 'culture' || raw === 'sport') return raw;
  // Zpětná kompatibilita se starší verzí JSON ('skating' | 'swimming')
  if (raw === 'skating' || raw === 'swimming') return 'sport';
  return 'culture';
}

function normalizeEvent(raw: Record<string, unknown>): ScheduleEvent {
  const city = normalizeCity(raw.city);
  const category = normalizeCategory(raw.category);
  const sourceUrl =
    typeof raw.sourceUrl === 'string' && raw.sourceUrl
      ? raw.sourceUrl
      : typeof raw.url === 'string'
        ? raw.url
        : '';

  return {
    id: String(raw.id ?? Math.random().toString(36).slice(2)),
    category,
    subcategory: (raw.subcategory as ScheduleEvent['subcategory']) ?? 'event',
    city,
    cityName:
      typeof raw.cityName === 'string' && raw.cityName
        ? raw.cityName
        : CITY_META[city].full,
    venue: String(raw.venue ?? CITY_META[city].full),
    title: String(raw.title ?? 'Událost'),
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
    date: String(raw.date ?? ''),
    startTime: String(raw.startTime ?? ''),
    endTime: typeof raw.endTime === 'string' && raw.endTime ? raw.endTime : undefined,
    startIso: String(raw.startIso ?? ''),
    endIso: String(raw.endIso ?? raw.startIso ?? ''),
    note: typeof raw.note === 'string' ? raw.note : undefined,
    url: typeof raw.url === 'string' && raw.url ? raw.url : sourceUrl || undefined,
    sourceUrl,
    imageUrl: typeof raw.imageUrl === 'string' && raw.imageUrl ? raw.imageUrl : undefined,
  };
}

function isValidPayload(data: unknown): data is EventsPayload {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<EventsPayload>;
  return (
    typeof candidate.lastUpdated === 'string' &&
    Array.isArray(candidate.events) &&
    typeof candidate.poolStatus === 'object' &&
    candidate.poolStatus !== null
  );
}

function normalizePayload(data: EventsPayload): EventsPayload {
  return {
    ...data,
    events: data.events.map((e) => normalizeEvent(e as unknown as Record<string, unknown>)),
  };
}

export function getBundledEvents(): EventsPayload {
  return normalizePayload(bundledEventsJson as unknown as EventsPayload);
}

/**
 * Okamžité načtení uložených dat z paměti telefonu (AsyncStorage),
 * případně přibaleného záložního souboru data/events.json.
 */
export async function loadLocalEvents(): Promise<EventsLoadResult> {
  try {
    const cachedRaw =
      (await AsyncStorage.getItem(STORAGE_KEY)) ??
      (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
    if (cachedRaw) {
      const parsed: unknown = JSON.parse(cachedRaw);
      if (isValidPayload(parsed)) {
        return { payload: normalizePayload(parsed), origin: 'cache' };
      }
    }
  } catch {
    // Pokud je cache poškozená nebo nedostupná, použijeme přibalený fallback
  }
  return { payload: getBundledEvents(), origin: 'bundled' };
}

/**
 * Stažení aktuálního rozpisu z GitHub Raw URL a uložení do offline cache.
 */
export async function refreshLiveEvents(): Promise<EventsLoadResult> {
  if (!isGitHubUrlConfigured()) {
    const local = await loadLocalEvents();
    return {
      ...local,
      error: 'GitHub URL pro živá data zatím není nastavena – zobrazen lokální rozpis.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const cacheBustUrl = `${GITHUB_RAW_URL}${
      GITHUB_RAW_URL.includes('?') ? '&' : '?'
    }t=${Date.now()}`;

    const response = await fetch(cacheBustUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Server vrátil chybu HTTP ${response.status}`);
    }

    const parsed: unknown = await response.json();
    if (!isValidPayload(parsed)) {
      throw new Error('Stažený soubor nemá očekávaný formát rozpisu.');
    }

    const normalized = normalizePayload(parsed);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Chyba zápisu do cache nebrání zobrazení stažených dat
    }

    return { payload: normalized, origin: 'live' };
  } catch (err) {
    const local = await loadLocalEvents();
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Vypršel časový limit připojení – zobrazena offline data.'
        : 'Nepodařilo se stáhnout aktuální data – zobrazena offline verze.';

    return {
      ...local,
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Načtení uložené preference sledovaných měst z AsyncStorage.
 * Prázdné pole [] znamená „Vše“ (všechna 4 města).
 */
export async function loadSelectedCities(): Promise<CityId[]> {
  try {
    const raw = await AsyncStorage.getItem(CITIES_PREF_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (c): c is CityId => typeof c === 'string' && ALL_CITIES.includes(c as CityId)
    );
    return valid.length === ALL_CITIES.length ? [] : valid;
  } catch {
    return [];
  }
}

export async function saveSelectedCities(cities: CityId[]): Promise<void> {
  try {
    const normalized = cities.length === ALL_CITIES.length ? [] : cities;
    await AsyncStorage.setItem(CITIES_PREF_KEY, JSON.stringify(normalized));
  } catch {
    // Tichý fallback
  }
}
