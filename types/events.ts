export type EventCategory = 'sport' | 'cinema' | 'culture';
export type EventSubcategory =
  | 'ice_skating'
  | 'pool'
  | 'sauna'
  | 'movie'
  | 'concert'
  | 'theatre'
  | 'exhibition'
  | 'event';

export type CityId = 'svetla' | 'hb' | 'ledec' | 'humpolec';
export type CategoryFilter = 'all' | EventCategory;
export type DataOrigin = 'live' | 'cache' | 'bundled';

export const ALL_CITIES: CityId[] = ['svetla', 'hb', 'ledec', 'humpolec'];

export const CITY_META: Record<CityId, { short: string; full: string }> = {
  svetla: { short: 'Světlá', full: 'Světlá nad Sázavou' },
  hb: { short: 'H. Brod', full: 'Havlíčkův Brod' },
  ledec: { short: 'Ledeč', full: 'Ledeč nad Sázavou' },
  humpolec: { short: 'Humpolec', full: 'Humpolec' },
};

export interface ScheduleEvent {
  id: string;
  category: EventCategory;
  subcategory: EventSubcategory;
  city: CityId;
  cityName: string;
  venue: string;
  title: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD (Europe/Prague)
  startTime: string; // HH:mm
  endTime?: string; // HH:mm (volitelné)
  startIso: string; // ISO-8601 UTC
  endIso: string; // ISO-8601 UTC
  note?: string;
  url?: string;
  sourceUrl: string;
  imageUrl?: string;
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
  timezone: string;
  poolStatus: PoolStatus;
  events: ScheduleEvent[];
  sources?: Record<string, unknown>;
}
