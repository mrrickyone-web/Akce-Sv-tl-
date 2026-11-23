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
  DataOrigin,
  EventsPayload,
  FilterOption,
  ScheduleEvent,
} from '../types/events';
import {
  addDays,
  formatCzechDateHeading,
  formatShortCzechDate,
  getLocalDateKey,
} from '../utils/date';

interface TodayTomorrowScreenProps {
  payload: EventsPayload;
  origin: DataOrigin;
  syncNote?: string | null;
  filter: FilterOption;
  refreshing: boolean;
  onRefresh: () => void;
  nowMs: number;
  theme: AppTheme;
}

function matchesFilter(event: ScheduleEvent, filter: FilterOption): boolean {
  if (filter === 'all') return true;
  return event.category === filter;
}

export function TodayTomorrowScreen({
  payload,
  origin,
  syncNote,
  filter,
  refreshing,
  onRefresh,
  nowMs,
  theme,
}: TodayTomorrowScreenProps) {
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = useMemo(() => getLocalDateKey(nowDate), [nowDate]);
  const tomorrowKey = useMemo(() => addDays(todayKey, 1), [todayKey]);

  const filteredEvents = useMemo(
    () => payload.events.filter((e) => matchesFilter(e, filter)),
    [payload.events, filter]
  );

  const todayEvents = useMemo(
    () => filteredEvents.filter((e) => e.date === todayKey),
    [filteredEvents, todayKey]
  );

  const tomorrowEvents = useMemo(
    () => filteredEvents.filter((e) => e.date === tomorrowKey),
    [filteredEvents, tomorrowKey]
  );

  const nextUpcomingSkating = useMemo(() => {
    if (filter === 'swimming') return null;
    const hasSkatingSoon = [...todayEvents, ...tomorrowEvents].some(
      (e) => e.category === 'skating'
    );
    if (hasSkatingSoon) return null;

    return (
      payload.events.find(
        (e) => e.category === 'skating' && Date.parse(e.endIso) > nowMs
      ) ?? null
    );
  }, [payload.events, todayEvents, tomorrowEvents, filter, nowMs]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {filter !== 'skating' && (
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
              {nextUpcomingSkating.startTime} – {nextUpcomingSkating.endTime}
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
          <Ionicons name="calendar-clear-outline" size={24} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Pro dnešní den nejsou vypsány žádné termíny v tomto filtru.
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
          <Ionicons name="calendar-clear-outline" size={24} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Na zítřek nejsou vypsány žádné termíny v tomto filtru.
          </Text>
        </View>
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
    paddingTop: 6,
  },
  upcomingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
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
