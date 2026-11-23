import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';
import { FilterOption } from '../types/events';

interface FilterChipsProps {
  selected: FilterOption;
  onSelect: (filter: FilterOption) => void;
  theme: AppTheme;
}

const FILTERS: {
  id: FilterOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'all', label: 'Vše', icon: 'apps-outline' },
  { id: 'skating', label: 'Bruslení (Světlá)', icon: 'snow-outline' },
  { id: 'swimming', label: 'Plavání (HB)', icon: 'water-outline' },
];

export function FilterChips({ selected, onSelect, theme }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {FILTERS.map((item) => {
        const isActive = selected === item.id;
        const activeColor =
          item.id === 'skating'
            ? theme.skating
            : item.id === 'swimming'
              ? theme.pool
              : theme.primary;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.chip,
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
              size={16}
              color={isActive ? '#FFFFFF' : theme.textSecondary}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? '#FFFFFF' : theme.text },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
