import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AppTheme } from '../theme/colors';
import { CITY_META, PoolStatus, ScheduleEvent } from '../types/events';
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

function getCategoryVisuals(event: ScheduleEvent, theme: AppTheme): {
  accent: string;
  soft: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  if (event.category === 'cinema') {
    return {
      accent: theme.cinema,
      soft: theme.cinemaSoft,
      icon: 'film-outline',
      label: 'Kino',
    };
  }
  if (event.category === 'culture') {
    const icon: keyof typeof Ionicons.glyphMap =
      event.subcategory === 'concert'
        ? 'musical-notes-outline'
        : event.subcategory === 'theatre'
          ? 'sparkles-outline'
          : event.subcategory === 'exhibition'
            ? 'color-palette-outline'
            : 'ticket-outline';
    return {
      accent: theme.culture,
      soft: theme.cultureSoft,
      icon,
      label: 'Kultura',
    };
  }
  // Sport subcategories
  if (event.subcategory === 'ice_skating') {
    return {
      accent: theme.skating,
      soft: theme.skatingSoft,
      icon: 'snow-outline',
      label: 'Bruslení',
    };
  }
  if (event.subcategory === 'sauna') {
    return {
      accent: theme.sauna,
      soft: theme.saunaSoft,
      icon: 'flame-outline',
      label: 'Sauna',
    };
  }
  if (event.subcategory === 'pool') {
    return {
      accent: theme.pool,
      soft: theme.poolSoft,
      icon: 'water-outline',
      label: 'Plavání',
    };
  }
  return {
    accent: theme.sport,
    soft: theme.sportSoft,
    icon: 'fitness-outline',
    label: 'Sport',
  };
}

function isTicketUrl(url: string): boolean {
  return /entradio|smsticket|disdata|goout|vstupenk|ticket/i.test(url);
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

  const visuals = getCategoryVisuals(event, theme);
  const cityColors = theme.cities[event.city];
  const targetUrl = event.url || event.sourceUrl;
  const hasTicketLink = Boolean(targetUrl && isTicketUrl(targetUrl));
  const isCultureOrCinema = event.category === 'cinema' || event.category === 'culture';

  const handleOpenBrowser = async () => {
    if (!targetUrl) return;
    try {
      await WebBrowser.openBrowserAsync(targetUrl, {
        toolbarColor: theme.isDark ? '#0B1120' : '#FFFFFF',
        controlsColor: visuals.accent,
        showTitle: true,
      });
    } catch {
      Linking.openURL(targetUrl).catch(() => {});
    }
  };

  const timeLabel = event.endTime
    ? `${event.startTime} – ${event.endTime}`
    : event.startTime;

  return (
    <Pressable
      onPress={handleOpenBrowser}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isLive ? theme.live : theme.border,
          borderWidth: isLive ? 1.5 : 1,
          opacity: isPast ? 0.6 : pressed ? 0.92 : 1,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View
        style={[
          styles.accentBar,
          { backgroundColor: isLive ? theme.live : visuals.accent },
        ]}
      />

      <View style={styles.content}>
        {/* Horní řádek: Čas + Stav + Město badge */}
        <View style={styles.topRow}>
          <View style={styles.timeWrapper}>
            <Ionicons
              name="time-outline"
              size={15}
              color={isLive ? theme.live : visuals.accent}
            />
            <Text style={[styles.timeText, { color: theme.text }]}>
              {timeLabel}
            </Text>
          </View>

          <View style={styles.badgesRight}>
            {isLive ? (
              <View style={[styles.liveBadge, { backgroundColor: theme.liveSoft }]}>
                <View style={[styles.liveDot, { backgroundColor: theme.live }]} />
                <Text style={[styles.liveText, { color: theme.live }]}>
                  Právě probíhá
                </Text>
              </View>
            ) : isSoon ? (
              <View style={[styles.statusBadge, { backgroundColor: visuals.soft }]}>
                <Text style={[styles.statusText, { color: visuals.accent }]}>
                  Za {minutesUntil} min
                </Text>
              </View>
            ) : isPast ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.surfaceSecondary },
                ]}
              >
                <Text style={[styles.statusText, { color: theme.textMuted }]}>
                  Skončilo
                </Text>
              </View>
            ) : null}

            <View style={[styles.cityBadge, { backgroundColor: cityColors.bg }]}>
              <Text style={[styles.cityBadgeText, { color: cityColors.fg }]}>
                {CITY_META[event.city].short}
              </Text>
            </View>
          </View>
        </View>

        {/* Hlavní řádek: Ikona / Plakát + Název + Místo */}
        <View style={styles.titleRow}>
          {event.imageUrl && isCultureOrCinema ? (
            <Image
              source={{ uri: event.imageUrl }}
              style={[styles.thumbnail, { backgroundColor: theme.surfaceSecondary }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: visuals.soft }]}>
              <Ionicons name={visuals.icon} size={19} color={visuals.accent} />
            </View>
          )}

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={styles.venueRow}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text
                style={[styles.venue, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {event.venue}
              </Text>
            </View>
            {event.subtitle ? (
              <Text
                style={[styles.subtitle, { color: theme.textMuted }]}
                numberOfLines={2}
              >
                {event.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Metriky bazénu/sauny (HB) */}
        {showPoolMetrics &&
          event.city === 'hb' &&
          (event.subcategory === 'pool' || event.subcategory === 'sauna') &&
          poolStatus && (
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
                  <Ionicons
                    name="people-outline"
                    size={13}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                    Obsazeno {poolStatus.poolOccupancy.occupied}/
                    {poolStatus.poolOccupancy.capacity}
                  </Text>
                </View>
              )}
              {event.subcategory === 'sauna' && poolStatus.saunaOccupancy && (
                <View style={[styles.metricPill, { backgroundColor: theme.saunaSoft }]}>
                  <Ionicons name="people-outline" size={13} color={theme.sauna} />
                  <Text style={[styles.metricText, { color: theme.sauna }]}>
                    Sauna {poolStatus.saunaOccupancy.occupied}/
                    {poolStatus.saunaOccupancy.capacity}
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

        {/* Tlačítko pro kino/kulturu na otevření vstupenek / detailu v prohlížeči */}
        {isCultureOrCinema && targetUrl ? (
          <View style={styles.actionRow}>
            <View style={[styles.categoryTag, { backgroundColor: visuals.soft }]}>
              <Ionicons name={visuals.icon} size={12} color={visuals.accent} />
              <Text style={[styles.categoryTagText, { color: visuals.accent }]}>
                {visuals.label}
              </Text>
            </View>

            <Pressable
              onPress={handleOpenBrowser}
              style={({ pressed }) => [
                styles.ticketBtn,
                {
                  backgroundColor: hasTicketLink ? visuals.accent : theme.surfaceSecondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={hasTicketLink ? 'ticket-outline' : 'open-outline'}
                size={13}
                color={hasTicketLink ? '#FFFFFF' : theme.text}
              />
              <Text
                style={[
                  styles.ticketBtnText,
                  { color: hasTicketLink ? '#FFFFFF' : theme.text },
                ]}
              >
                {hasTicketLink ? 'Vstupenky' : 'Detail akce'}
              </Text>
            </Pressable>
          </View>
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
    padding: 13,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    gap: 6,
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  cityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  venue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  ticketBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
