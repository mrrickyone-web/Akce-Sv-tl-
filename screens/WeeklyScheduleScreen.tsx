import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from '../components/EventCard';
import { LastUpdatedFooter } from '../components/LastUpdatedFooter';
import { AppTheme } from '../theme/colors';
import {
  CategoryFilter,
  CityId,
  DataOrigin,
  EventsPayload,
  ScheduleEvent,
} from '../types/events';
import {
  formatCzechDateHeading,
  getLocalDateKey,
  getWeekDays,
} from '../utils/date';
import { filterEvents } from '../utils/filter';

interface WeeklyScheduleScreenProps {
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

export function WeeklyScheduleScreen({
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
}: WeeklyScheduleScreenProps) {
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
  const todayKey = useMemo(() => getLocalDateKey(nowDate), [nowDate]);

  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const weekDays = useMemo(
    () => getWeekDays(weekOffset, nowDate),
    [weekOffset, nowDate]
  );

  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const activeDateKey = useMemo(() => {
    const existsInWeek = weekDays.some((d) => d.dateKey === selectedDateKey);
    if (existsInWeek) return selectedDateKey;
    return weekDays.find((d) => d.isToday)?.dateKey ?? weekDays[0].dateKey;
  }, [weekDays, selectedDateKey]);

  const nextWeekDays = useMemo(() => getWeekDays(1, nowDate), [nowDate]);
  const hasNextWeekEvents = useMemo(() => {
    const keys = new Set(nextWeekDays.map((d) => d.dateKey));
    return payload.events.some((e) => keys.has(e.date));
  }, [payload.events, nextWeekDays]);

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = eventsByDate.get(activeDateKey) ?? [];

  const handleSwitchWeek = (nextOffset: 0 | 1) => {
    setWeekOffset(nextOffset);
    const nextDays = getWeekDays(nextOffset, nowDate);
    const defaultDay = nextDays.find((d) => d.isToday) ?? nextDays[0];
    setSelectedDateKey(defaultDay.dateKey);
  };

  return (
    <View style={styles.container}>
      {hasNextWeekEvents && (
        <View style={styles.weekToggleRow}>
          <Pressable
            onPress={() => handleSwitchWeek(0)}
            style={[
              styles.weekToggleBtn,
              {
                backgroundColor:
                  weekOffset === 0 ? theme.primarySoft : theme.surface,
                borderColor: weekOffset === 0 ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.weekToggleText,
                { color: weekOffset === 0 ? theme.primary : theme.textSecondary },
              ]}
            >
              Tento týden
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSwitchWeek(1)}
            style={[
              styles.weekToggleBtn,
              {
                backgroundColor:
                  weekOffset === 1 ? theme.primarySoft : theme.surface,
                borderColor: weekOffset === 1 ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.weekToggleText,
                { color: weekOffset === 1 ? theme.primary : theme.textSecondary },
              ]}
            >
              Příští týden
            </Text>
          </Pressable>
        </View>
      )}

      {/* Výběr dne Po–Ne */}
      <View style={[styles.dayStrip, { borderBottomColor: theme.border }]}>
        {weekDays.map((day) => {
          const isSelected = day.dateKey === activeDateKey;
          const dayEvents = eventsByDate.get(day.dateKey) ?? [];
          const hasSport = dayEvents.some((e) => e.category === 'sport');
          const hasCinema = dayEvents.some((e) => e.category === 'cinema');
          const hasCulture = dayEvents.some((e) => e.category === 'culture');

          return (
            <Pressable
              key={day.dateKey}
              onPress={() => setSelectedDateKey(day.dateKey)}
              style={[
                styles.dayPill,
                {
                  backgroundColor: isSelected
                    ? theme.primary
                    : day.isToday
                      ? theme.primarySoft
                      : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.dayShort,
                  {
                    color: isSelected
                      ? '#FFFFFF'
                      : day.isToday
                        ? theme.primary
                        : theme.textMuted,
                  },
                ]}
              >
                {day.shortLabel}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: isSelected ? '#FFFFFF' : theme.text,
                  },
                ]}
              >
                {day.dayNumber}
              </Text>
              <View style={styles.dotsRow}>
                {hasSport && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected ? '#CCFBF1' : theme.sport,
                      },
                    ]}
                  />
                )}
                {hasCinema && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected ? '#E0E7FF' : theme.cinema,
                      },
                    ]}
                  />
                )}
                {hasCulture && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected ? '#FFE4E6' : theme.culture,
                      },
                    ]}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

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
        <View style={styles.selectedHeader}>
          <Text style={[styles.selectedTitle, { color: theme.text }]}>
            {formatCzechDateHeading(activeDateKey)}
          </Text>
          <Text style={[styles.selectedCount, { color: theme.textMuted }]}>
            {selectedDayEvents.length === 0
              ? 'Bez akcí'
              : selectedDayEvents.length === 1
                ? '1 akce'
                : selectedDayEvents.length <= 4
                  ? `${selectedDayEvents.length} akce`
                  : `${selectedDayEvents.length} akcí`}
          </Text>
        </View>

        {selectedDayEvents.length > 0 ? (
          selectedDayEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              poolStatus={payload.poolStatus}
              showPoolMetrics={activeDateKey === todayKey}
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
            <Ionicons name="calendar-outline" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Žádné vypsané akce
            </Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Pro tento den a vybraný filtr nebyla nalezena žádná akce.
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  weekToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  weekToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayShort: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectedTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
