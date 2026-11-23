import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';
import { PoolStatus, ScheduleEvent } from '../types/events';
import {
  getMinutesUntilStart,
  isEventHappeningNow,
  isEventPast,
} from '../utils/date';

interface EventCardProps {
  event: ScheduleEvent;
  poolStatus?: PoolStatus;
  showPoolMetrics?: boolean;
  nowMs: number;
  theme: AppTheme;
}

export function EventCard({
  event,
  poolStatus,
  showPoolMetrics = false,
  nowMs,
  theme,
}: EventCardProps) {
  const isLive = isEventHappeningNow(event, nowMs);
  const isPast = isEventPast(event, nowMs);
  const minutesUntil = !isLive && !isPast ? getMinutesUntilStart(event, nowMs) : null;
  const isSoon = minutesUntil !== null && minutesUntil <= 90;

  const isSkating = event.subcategory === 'ice_skating';
  const isSauna = event.subcategory === 'sauna';

  const accentColor = isSkating
    ? theme.skating
    : isSauna
      ? theme.sauna
      : theme.pool;

  const accentSoft = isSkating
    ? theme.skatingSoft
    : isSauna
      ? theme.saunaSoft
      : theme.poolSoft;

  const iconName: keyof typeof Ionicons.glyphMap = isSkating
    ? 'snow-outline'
    : isSauna
      ? 'flame-outline'
      : 'water-outline';

  const handleOpenSource = () => {
    if (event.sourceUrl) {
      Linking.openURL(event.sourceUrl).catch(() => {});
    }
  };

  return (
    <Pressable
      onPress={handleOpenSource}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isLive ? theme.live : theme.border,
          borderWidth: isLive ? 1.5 : 1,
          opacity: isPast ? 0.58 : pressed ? 0.92 : 1,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: isLive ? theme.live : accentColor }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.timeWrapper}>
            <Ionicons name="time-outline" size={16} color={isLive ? theme.live : accentColor} />
            <Text style={[styles.timeText, { color: theme.text }]}>
              {event.startTime} – {event.endTime}
            </Text>
          </View>

          {isLive ? (
            <View style={[styles.liveBadge, { backgroundColor: theme.liveSoft }]}>
              <View style={[styles.liveDot, { backgroundColor: theme.live }]} />
              <Text style={[styles.liveText, { color: theme.live }]}>
                Právě probíhá
              </Text>
            </View>
          ) : isSoon ? (
            <View style={[styles.statusBadge, { backgroundColor: accentSoft }]}>
              <Text style={[styles.statusText, { color: accentColor }]}>
                Za {minutesUntil} min
              </Text>
            </View>
          ) : isPast ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.surfaceSecondary }]}>
              <Text style={[styles.statusText, { color: theme.textMuted }]}>
                Skončilo
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: accentSoft }]}>
            <Ionicons name={iconName} size={18} color={accentColor} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {event.title}
            </Text>
            <View style={styles.venueRow}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.venue, { color: theme.textSecondary }]} numberOfLines={1}>
                {event.venue} • {event.city}
              </Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={16} color={theme.textMuted} />
        </View>

        {showPoolMetrics && event.category === 'swimming' && poolStatus && (
          <View style={styles.metricsRow}>
            {event.subcategory === 'pool' && poolStatus.poolTempC !== null && (
              <View style={[styles.metricPill, { backgroundColor: theme.poolSoft }]}>
                <Ionicons name="thermometer-outline" size={13} color={theme.pool} />
                <Text style={[styles.metricText, { color: theme.pool }]}>
                  Voda {poolStatus.poolTempC.toFixed(1).replace('.', ',')} °C
                </Text>
              </View>
            )}
            {event.subcategory === 'pool' && poolStatus.poolOccupancy && (
              <View style={[styles.metricPill, { backgroundColor: theme.background }]}>
                <Ionicons name="people-outline" size={13} color={theme.textSecondary} />
                <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                  Obsazeno {poolStatus.poolOccupancy.occupied}/{poolStatus.poolOccupancy.capacity}
                </Text>
              </View>
            )}
            {event.subcategory === 'sauna' && poolStatus.saunaOccupancy && (
              <View style={[styles.metricPill, { backgroundColor: theme.saunaSoft }]}>
                <Ionicons name="people-outline" size={13} color={theme.sauna} />
                <Text style={[styles.metricText, { color: theme.sauna }]}>
                  Sauna {poolStatus.saunaOccupancy.occupied}/{poolStatus.saunaOccupancy.capacity}
                </Text>
              </View>
            )}
          </View>
        )}

        {event.note ? (
          <Text
            style={[styles.note, { color: theme.textMuted }]}
            numberOfLines={2}
          >
            {event.note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  accentBar: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  venue: {
    fontSize: 12,
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
});
