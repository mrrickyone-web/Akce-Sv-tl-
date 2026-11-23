export type EventCategory = 'skating' | 'swimming';
export type EventSubcategory = 'ice_skating' | 'pool' | 'sauna';
export type FilterOption = 'all' | 'skating' | 'swimming';
export type DataOrigin = 'live' | 'cache' | 'bundled';

export interface ScheduleEvent {
  id: string;
  category: EventCategory;
  subcategory: EventSubcategory;
  title: string;
  subtitle?: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD (Europe/Prague)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startIso: string; // ISO-8601 UTC
  endIso: string; // ISO-8601 UTC
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
  timezone: string;
  poolStatus: PoolStatus;
  events: ScheduleEvent[];
  sources?: {
    skating: { url: string; ok: boolean; count: number; error?: string };
    swimming: { url: string; ok: boolean; count: number; error?: string };
    poolStatus: { url: string; ok: boolean; error?: string };
  };
}
