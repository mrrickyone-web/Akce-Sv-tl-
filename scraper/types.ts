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

export const CITY_NAMES: Record<CityId, string> = {
  svetla: 'Světlá nad Sázavou',
  hb: 'Havlíčkův Brod',
  ledec: 'Ledeč nad Sázavou',
  humpolec: 'Humpolec',
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
  startTime: string; // HH:mm (Europe/Prague)
  endTime?: string; // HH:mm (optional for cinema/culture without explicit end)
  startIso: string; // ISO-8601 UTC
  endIso: string; // ISO-8601 UTC
  note?: string;
  url?: string; // Detail / tickets link
  sourceUrl: string; // Always present fallback URL
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

export interface SourceReport {
  id: string;
  city: CityId;
  label: string;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface EventsPayload {
  lastUpdated: string;
  timezone: 'Europe/Prague';
  poolStatus: PoolStatus;
  events: ScheduleEvent[];
  sources: Record<string, SourceReport>;
}
