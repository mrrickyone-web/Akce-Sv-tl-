import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';
import {
  ALL_CITIES,
  CategoryFilter,
  CITY_META,
  CityId,
} from '../types/events';

interface FilterChipsProps {
  selectedCategory: CategoryFilter;
  onSelectCategory: (category: CategoryFilter) => void;
  selectedCities: CityId[]; // [] = Vše
  onToggleCity: (city: CityId | 'all') => void;
  theme: AppTheme;
}

const CATEGORIES: {
  id: CategoryFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'all', label: 'Vše', icon: 'apps-outline' },
  { id: 'sport', label: 'Sport', icon: 'fitness-outline' },
  { id: 'cinema', label: 'Kino', icon: 'film-outline' },
  { id: 'culture', label: 'Kultura', icon: 'musical-notes-outline' },
];

export function FilterChips({
  selectedCategory,
  onSelectCategory,
  selectedCities,
  onToggleCity,
  theme,
}: FilterChipsProps) {
  const allCitiesSelected = selectedCities.length === 0;

  return (
    <View style={[styles.wrapper, { borderBottomColor: theme.border }]}>
      {/* Úroveň 1: Hlavní kategorie */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {CATEGORIES.map((item) => {
          const isActive = selectedCategory === item.id;
          const activeColor =
            item.id === 'sport'
              ? theme.sport
              : item.id === 'cinema'
                ? theme.cinema
                : item.id === 'culture'
                  ? theme.culture
                  : theme.primary;

          return (
            <Pressable
              key={item.id}
              onPress={() => onSelectCategory(item.id)}
              style={({ pressed }) => [
                styles.categoryChip,
                {
                  backgroundColor: isActive ? activeColor : theme.surface,
                  borderColor: isActive ? activeColor : theme.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={isActive ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  { color: isActive ? '#FFFFFF' : theme.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Úroveň 2: Štítky měst (s uložením do AsyncStorage) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, styles.cityRow]}
      >
        <Pressable
          onPress={() => onToggleCity('all')}
          style={({ pressed }) => [
            styles.cityChip,
            {
              backgroundColor: allCitiesSelected
                ? theme.primarySoft
                : theme.surface,
              borderColor: allCitiesSelected ? theme.primary : theme.border,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: allCitiesSelected }}
        >
          <Ionicons
            name="location-outline"
            size={13}
            color={allCitiesSelected ? theme.primary : theme.textMuted}
          />
          <Text
            style={[
              styles.cityLabel,
              { color: allCitiesSelected ? theme.primary : theme.textSecondary },
            ]}
          >
            Vše
          </Text>
        </Pressable>

        {ALL_CITIES.map((cityId) => {
          const isActive = selectedCities.includes(cityId);
          const palette = theme.cities[cityId];

          return (
            <Pressable
              key={cityId}
              onPress={() => onToggleCity(cityId)}
              style={({ pressed }) => [
                styles.cityChip,
                {
                  backgroundColor: isActive ? palette.bg : theme.surface,
                  borderColor: isActive ? palette.fg : theme.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              {isActive && (
                <Ionicons name="checkmark" size={13} color={palette.fg} />
              )}
              <Text
                style={[
                  styles.cityLabel,
                  { color: isActive ? palette.fg : theme.textSecondary },
                ]}
              >
                {CITY_META[cityId].short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 7,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
  cityRow: {
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  cityLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
