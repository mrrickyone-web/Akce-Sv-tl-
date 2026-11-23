import { CategoryFilter, CityId, ScheduleEvent } from '../types/events';

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterEvents(
  events: ScheduleEvent[],
  category: CategoryFilter,
  selectedCities: CityId[],
  searchQuery: string
): ScheduleEvent[] {
  const q = normalizeSearch(searchQuery);

  return events.filter((ev) => {
    if (category !== 'all' && ev.category !== category) {
      return false;
    }

    if (selectedCities.length > 0 && !selectedCities.includes(ev.city)) {
      return false;
    }

    if (q) {
      const haystack = normalizeSearch(
        `${ev.title} ${ev.subtitle ?? ''} ${ev.venue} ${ev.cityName} ${ev.note ?? ''}`
      );
      return haystack.includes(q);
    }

    return true;
  });
}
