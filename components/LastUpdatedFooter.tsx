import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';
import { DataOrigin } from '../types/events';
import { formatLastUpdated } from '../utils/date';

interface LastUpdatedFooterProps {
  lastUpdated: string;
  origin: DataOrigin;
  syncNote?: string | null;
  theme: AppTheme;
}

export function LastUpdatedFooter({
  lastUpdated,
  origin,
  syncNote,
  theme,
}: LastUpdatedFooterProps) {
  const originLabel =
    origin === 'live'
      ? 'Živá data'
      : origin === 'cache'
        ? 'Offline paměť'
        : 'Vestavěný rozpis';

  const originIcon: keyof typeof Ionicons.glyphMap =
    origin === 'live'
      ? 'cloud-done-outline'
      : origin === 'cache'
        ? 'phone-portrait-outline'
        : 'archive-outline';

  return (
    <View style={[styles.container, { borderTopColor: theme.border }]}>
      <View style={styles.row}>
        <Ionicons name="sync-outline" size={14} color={theme.textMuted} />
        <Text style={[styles.text, { color: theme.textMuted }]}>
          Poslední aktualizace dat: {formatLastUpdated(lastUpdated)}
        </Text>
      </View>

      <View style={[styles.badge, { backgroundColor: theme.surfaceSecondary }]}>
        <Ionicons name={originIcon} size={13} color={theme.textSecondary} />
        <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
          {originLabel}
        </Text>
      </View>

      {syncNote ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>{syncNote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 2,
  },
});
