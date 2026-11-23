import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FilterChips } from './components/FilterChips';
import { TodayTomorrowScreen } from './screens/TodayTomorrowScreen';
import { WeeklyScheduleScreen } from './screens/WeeklyScheduleScreen';
import {
  getBundledEvents,
  loadLocalEvents,
  refreshLiveEvents,
} from './services/events';
import { darkTheme, lightTheme } from './theme/colors';
import { DataOrigin, EventsPayload, FilterOption } from './types/events';

type TabKey = 'today' | 'week';

function MainApp() {
  const systemScheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);
  const isDark = themeOverride ? themeOverride === 'dark' : systemScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [payload, setPayload] = useState<EventsPayload>(() => getBundledEvents());
  const [origin, setOrigin] = useState<DataOrigin>('bundled');
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Průběžná aktualizace času pro indikátor "Právě probíhá"
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await refreshLiveEvents();
      setPayload(result.payload);
      setOrigin(result.origin);
      setSyncNote(result.error ?? null);
      setNowMs(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Offline-first načtení při spuštění aplikace
  useEffect(() => {
    let mounted = true;
    (async () => {
      const local = await loadLocalEvents();
      if (mounted) {
        setPayload(local.payload);
        setOrigin(local.origin);
      }
      const live = await refreshLiveEvents();
      if (mounted) {
        setPayload(live.payload);
        setOrigin(live.origin);
        setSyncNote(live.error ?? null);
        setNowMs(Date.now());
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    setThemeOverride(isDark ? 'light' : 'dark');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTitles}>
          <Text style={[styles.appTitle, { color: theme.text }]}>
            Akce Světlá
          </Text>
          <Text style={[styles.appSubtitle, { color: theme.textMuted }]}>
            Bruslení Pěšinky & bazén Havlíčkův Brod
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityLabel="Aktualizovat rozpis"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={theme.text} />
            )}
          </Pressable>

          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityLabel="Přepnout světlý a tmavý režim"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={theme.text}
            />
          </Pressable>
        </View>
      </View>

      {/* Rychlé filtry */}
      <FilterChips selected={filter} onSelect={setFilter} theme={theme} />

      {/* Aktivní obrazovka */}
      <View style={styles.screenContainer}>
        {activeTab === 'today' ? (
          <TodayTomorrowScreen
            payload={payload}
            origin={origin}
            syncNote={syncNote}
            filter={filter}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            nowMs={nowMs}
            theme={theme}
          />
        ) : (
          <WeeklyScheduleScreen
            payload={payload}
            origin={origin}
            syncNote={syncNote}
            filter={filter}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            nowMs={nowMs}
            theme={theme}
          />
        )}
      </View>

      {/* Spodní navigace */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.tabBarBg,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => setActiveTab('today')}
          style={styles.tabItem}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'today' }}
        >
          <Ionicons
            name={activeTab === 'today' ? 'today' : 'today-outline'}
            size={22}
            color={activeTab === 'today' ? theme.primary : theme.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'today' ? theme.primary : theme.textMuted,
              },
            ]}
          >
            Dnes a zítra
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('week')}
          style={styles.tabItem}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'week' }}
        >
          <Ionicons
            name={activeTab === 'week' ? 'calendar' : 'calendar-outline'}
            size={22}
            color={activeTab === 'week' ? theme.primary : theme.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'week' ? theme.primary : theme.textMuted,
              },
            ]}
          >
            Týdenní rozpis
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitles: {
    flex: 1,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
