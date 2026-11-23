import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from '../components/EventCard';
import { LastUpdatedFooter } from '../components/LastUpdatedFooter';
import { PoolStatusBanner } from '../components/PoolStatusBanner';
import { AppTheme } from '../theme/colors';
import {
  CategoryFilter,
  CityId,
  DataOrigin,
  EventsPayload,
  ScheduleEvent,
} from '../types/events';
import {
  addDays,
  formatCzechDateHeading,
  formatShortCzechDate,
  getLocalDateKey,
} from '../utils/date';
import { filterEvents } from '../utils/filter';

interface TodayTomorrowScreenProps {
  payload: EventsPayload;
  origin: DataOrigin;
  syncNote?: string | null;
  categoryFilter: CategoryFilter;
  selectedCities: CityId[];
  searchQuery: string;
  refreshing: boolean;
  onRefresh: () => void;
  nowMs: number;
  theme: AppTheme;
}

export function TodayTomorrowScreen({
  payload,
  origin,
  syncNote,
  categoryFilter,
  selectedCities,
  searchQuery,
  refreshing,
  onRefresh,
  nowMs,
  theme,
}: TodayTomorrowScreenProps) {
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = useMemo(() => getLocalDateKey(nowDate), [nowDate]);
  const tomorrowKey = useMemo(() => addDays(todayKey, 1), [todayKey]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredEvents = useMemo(
    () =>
      filterEvents(
        payload.events,
        categoryFilter,
        selectedCities,
        searchQuery
      ),
    [payload.events, categoryFilter, selectedCities, searchQuery]
  );

  // Když uživatel hledá přes lupu, zobrazíme výsledky napříč všemi nadcházejícími dny
  const searchGroups = useMemo(() => {
    if (!isSearching) return [];
    const grouped = new Map<string, ScheduleEvent[]>();
    for (const ev of filteredEvents) {
      if (ev.date < todayKey) continue;
      const list = grouped.get(ev.date) ?? [];
      list.push(ev);
      grouped.set(ev.date, list);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents, isSearching, todayKey]);

  const todayEvents = useMemo(
    () => filteredEvents.filter((e) => e.date === todayKey),
    [filteredEvents, todayKey]
  );

  const tomorrowEvents = useMemo(
    () => filteredEvents.filter((e) => e.date === tomorrowKey),
    [filteredEvents, tomorrowKey]
  );

  const showPoolBanner =
    !isSearching &&
    (categoryFilter === 'all' || categoryFilter === 'sport') &&
    (selectedCities.length === 0 || selectedCities.includes('hb'));

  const nextUpcomingSkating = useMemo(() => {
    if (isSearching) return null;
    if (categoryFilter !== 'all' && categoryFilter !== 'sport') return null;
    if (selectedCities.length > 0 && !selectedCities.includes('svetla')) return null;

    const hasSkatingSoon = [...todayEvents, ...tomorrowEvents].some(
      (e) => e.subcategory === 'ice_skating'
    );
    if (hasSkatingSoon) return null;

    return (
      payload.events.find(
        (e) => e.subcategory === 'ice_skating' && Date.parse(e.endIso) > nowMs
      ) ?? null
    );
  }, [
    payload.events,
    todayEvents,
    tomorrowEvents,
    categoryFilter,
    selectedCities,
    isSearching,
    nowMs,
  ]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {isSearching ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Výsledky hledání
            </Text>
            <Text style={[styles.sectionDate, { color: theme.textMuted }]}>
              {searchGroups.reduce((acc, [, list]) => acc + list.length, 0)} akcí
            </Text>
          </View>

          {searchGroups.length > 0 ? (
            searchGroups.map(([dateKey, items]) => (
              <View key={dateKey} style={styles.searchGroup}>
                <Text style={[styles.searchDateHeader, { color: theme.primary }]}>
                  {dateKey === todayKey
                    ? `Dnes • ${formatCzechDateHeading(dateKey)}`
                    : dateKey === tomorrowKey
                      ? `Zítra • ${formatCzechDateHeading(dateKey)}`
                      : formatCzechDateHeading(dateKey)}
                </Text>
                {items.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    poolStatus={payload.poolStatus}
                    showPoolMetrics={dateKey === todayKey}
                    nowMs={nowMs}
                    theme={theme}
                  />
                ))}
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="search-outline" size={26} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Pro dotaz „{searchQuery.trim()}“ nebyly nalezeny žádné nadcházející akce.
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {showPoolBanner && (
            <PoolStatusBanner status={payload.poolStatus} theme={theme} />
          )}

          {nextUpcomingSkating && (
            <View
              style={[
                styles.upcomingHint,
                {
                  backgroundColor: theme.skatingSoft,
                  borderColor: theme.skating,
                },
              ]}
            >
              <Ionicons name="snow-outline" size={18} color={theme.skating} />
              <View style={styles.upcomingHintText}>
                <Text style={[styles.upcomingHintTitle, { color: theme.skating }]}>
                  Nejbližší veřejné bruslení (Světlá)
                </Text>
                <Text style={[styles.upcomingHintSub, { color: theme.text }]}>
                  {formatShortCzechDate(nextUpcomingSkating.date)} •{' '}
                  {nextUpcomingSkating.startTime}
                  {nextUpcomingSkating.endTime
                    ? ` – ${nextUpcomingSkating.endTime}`
                    : ''}
                </Text>
              </View>
            </View>
          )}

          {/* DNES */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Dnes</Text>
            <Text style={[styles.sectionDate, { color: theme.textMuted }]}>
              {formatCzechDateHeading(todayKey)}
            </Text>
          </View>

          {todayEvents.length > 0 ? (
            todayEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                poolStatus={payload.poolStatus}
                showPoolMetrics
                nowMs={nowMs}
                theme={theme}
              />
            ))
          ) : (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={24}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Pro dnešní den nejsou vypsány žádné akce v tomto filtru.
              </Text>
            </View>
          )}

          {/* ZÍTRA */}
          <View style={[styles.sectionHeader, styles.secondSection]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Zítra</Text>
            <Text style={[styles.sectionDate, { color: theme.textMuted }]}>
              {formatCzechDateHeading(tomorrowKey)}
            </Text>
          </View>

          {tomorrowEvents.length > 0 ? (
            tomorrowEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                poolStatus={payload.poolStatus}
                showPoolMetrics={false}
                nowMs={nowMs}
                theme={theme}
              />
            ))
          ) : (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={24}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Na zítřek nejsou vypsány žádné akce v tomto filtru.
              </Text>
            </View>
          )}
        </>
      )}

      <LastUpdatedFooter
        lastUpdated={payload.lastUpdated}
        origin={origin}
        syncNote={syncNote}
        theme={theme}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchGroup: {
    marginBottom: 12,
  },
  searchDateHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  upcomingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  upcomingHintText: {
    flex: 1,
  },
  upcomingHintTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  upcomingHintSub: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  secondSection: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
