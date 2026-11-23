import AsyncStorage from '@react-native-async-storage/async-storage';
import bundledEventsJson from '../data/events.json';
import { DataOrigin, EventsPayload } from '../types/events';

/**
 * URL k živému JSON souboru v GitHub repozitáři.
 * Po propojení s vaším GitHub repozitářem nahraďte <UZIVATEL> a <REPOZITAR>.
 */
export const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/mrrickyone-web/Akce-Sv-tl-/main/data/events.json';

const STORAGE_KEY = 'akce_svetla_events_cache_v1';
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

export function getBundledEvents(): EventsPayload {
  return bundledEventsJson as EventsPayload;
}

/**
 * Okamžité načtení uložených dat z paměti telefonu (AsyncStorage),
 * případně přibaleného záložního souboru data/events.json.
 */
export async function loadLocalEvents(): Promise<EventsLoadResult> {
  try {
    const cachedRaw = await AsyncStorage.getItem(STORAGE_KEY);
    if (cachedRaw) {
      const parsed: unknown = JSON.parse(cachedRaw);
      if (isValidPayload(parsed)) {
        return { payload: parsed, origin: 'cache' };
      }
    }
  } catch {
    // Pokud je cache poškozená nebo nedostupná, použijeme přibalený fallback
  }
  return { payload: getBundledEvents(), origin: 'bundled' };
}

/**
 * Stažení aktuálního rozpisu z GitHub Raw URL a uložení do offline cache.
 * Při nedostupnosti sítě (nebo před nastavením GitHub URL) vrátí cache/fallback.
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

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Chyba zápisu do cache nebrání zobrazení stažených dat
    }

    return { payload: parsed, origin: 'live' };
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
