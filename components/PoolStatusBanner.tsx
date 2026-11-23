import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';
import { PoolStatus } from '../types/events';

interface PoolStatusBannerProps {
  status: PoolStatus;
  theme: AppTheme;
}

function formatTemp(temp: number | null): string {
  if (temp === null) return '—';
  return `${temp.toFixed(1).replace('.', ',')} °C`;
}

export function PoolStatusBanner({ status, theme }: PoolStatusBannerProps) {
  const hasAnyData =
    status.poolTempC !== null ||
    status.kidsPoolTempC !== null ||
    status.poolOccupancy !== null ||
    status.saunaOccupancy !== null;

  if (!hasAnyData) return null;

  const poolPct =
    status.poolOccupancy && status.poolOccupancy.capacity > 0
      ? Math.min(100, Math.round((status.poolOccupancy.occupied / status.poolOccupancy.capacity) * 100))
      : 0;

  const saunaPct =
    status.saunaOccupancy && status.saunaOccupancy.capacity > 0
      ? Math.min(100, Math.round((status.saunaOccupancy.occupied / status.saunaOccupancy.capacity) * 100))
      : 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: theme.poolSoft }]}>
          <Ionicons name="thermometer-outline" size={18} color={theme.pool} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>
            Bazén & sauna Havlíčkův Brod
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Aktuální teplota vody a obsazenost
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {status.poolTempC !== null && (
          <View style={[styles.statBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              Velký bazén
            </Text>
            <Text style={[styles.statValue, { color: theme.pool }]}>
              {formatTemp(status.poolTempC)}
            </Text>
            {status.kidsPoolTempC !== null && (
              <Text style={[styles.statSub, { color: theme.textSecondary }]}>
                Dětský: {formatTemp(status.kidsPoolTempC)}
              </Text>
            )}
          </View>
        )}

        {status.poolOccupancy && (
          <View style={[styles.statBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              Obsazenost bazénu
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {status.poolOccupancy.occupied}
              <Text style={[styles.statCap, { color: theme.textMuted }]}>
                /{status.poolOccupancy.capacity}
              </Text>
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${poolPct}%`,
                    backgroundColor: poolPct > 80 ? theme.warning : theme.pool,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {status.saunaOccupancy && (
          <View style={[styles.statBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              Obsazenost sauny
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {status.saunaOccupancy.occupied}
              <Text style={[styles.statCap, { color: theme.textMuted }]}>
                /{status.saunaOccupancy.capacity}
              </Text>
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${saunaPct}%`,
                    backgroundColor: saunaPct > 80 ? theme.warning : theme.sauna,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  statCap: {
    fontSize: 12,
    fontWeight: '600',
  },
  statSub: {
    fontSize: 11,
    marginTop: 3,
  },
  progressTrack: {
    height: 5,
    borderRadius: 99,
    marginTop: 7,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
});
