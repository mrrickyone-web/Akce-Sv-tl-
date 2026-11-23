import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  loadSelectedCities,
  refreshLiveEvents,
  saveSelectedCities,
} from './services/events';
import { darkTheme, lightTheme } from './theme/colors';
import {
  ALL_CITIES,
  CategoryFilter,
  CityId,
  DataOrigin,
  EventsPayload,
} from './types/events';

type TabKey = 'today' | 'week';

function MainApp() {
  const systemScheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);
  const isDark = themeOverride ? themeOverride === 'dark' : systemScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedCities, setSelectedCities] = useState<CityId[]>([]); // [] = Vše
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Načtení uložených měst při startu
  useEffect(() => {
    let mounted = true;
    loadSelectedCities().then((saved) => {
      if (mounted) {
        setSelectedCities(saved);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleCity = useCallback((city: CityId | 'all') => {
    setSelectedCities((prev) => {
      let next: CityId[];
      if (city === 'all') {
        next = [];
      } else if (prev.includes(city)) {
        next = prev.filter((c) => c !== city);
      } else {
        const added = [...prev, city];
        next = added.length >= ALL_CITIES.length ? [] : added;
      }
      saveSelectedCities(next);
      return next;
    });
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

  const toggleSearch = () => {
    setSearchOpen((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
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
            Světlá • H. Brod • Ledeč • Humpolec
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={toggleSearch}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor:
                  searchOpen || searchQuery ? theme.primarySoft : theme.surface,
                borderColor:
                  searchOpen || searchQuery ? theme.primary : theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityLabel="Vyhledat film nebo akci"
          >
            <Ionicons
              name={searchOpen ? 'close-outline' : 'search-outline'}
              size={20}
              color={searchOpen || searchQuery ? theme.primary : theme.text}
            />
          </Pressable>

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

      {/* Rozbalovací fulltextové vyhledávání */}
      {searchOpen && (
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.searchInputWrap,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Hledat film, koncert, divadlo, místo..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                accessibilityLabel="Vymazat hledání"
              >
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Dvouúrovňové filtry: Kategorie + Města */}
      <FilterChips
        selectedCategory={categoryFilter}
        onSelectCategory={setCategoryFilter}
        selectedCities={selectedCities}
        onToggleCity={handleToggleCity}
        theme={theme}
      />

      {/* Aktivní obrazovka */}
      <View style={styles.screenContainer}>
        {activeTab === 'today' ? (
          <TodayTomorrowScreen
            payload={payload}
            origin={origin}
            syncNote={syncNote}
            categoryFilter={categoryFilter}
            selectedCities={selectedCities}
            searchQuery={searchQuery}
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
            categoryFilter={categoryFilter}
            selectedCities={selectedCities}
            searchQuery={searchQuery}
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
    paddingBottom: 11,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitles: {
    flex: 1,
  },
  appTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 7,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
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
