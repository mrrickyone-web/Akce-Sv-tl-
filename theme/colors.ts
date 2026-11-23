import { CityId } from '../types/events';

export interface CityColors {
  fg: string;
  bg: string;
}

export interface AppTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  sport: string;
  sportSoft: string;
  skating: string;
  skatingSoft: string;
  pool: string;
  poolSoft: string;
  sauna: string;
  saunaSoft: string;
  cinema: string;
  cinemaSoft: string;
  culture: string;
  cultureSoft: string;
  cities: Record<CityId, CityColors>;
  live: string;
  liveSoft: string;
  warning: string;
  warningSoft: string;
  tabBarBg: string;
  shadow: string;
}

export const lightTheme: AppTheme = {
  isDark: false,
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#E2E8F0',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  primary: '#0284C7',
  primarySoft: '#E0F2FE',
  sport: '#0D9488',
  sportSoft: '#CCFBF1',
  skating: '#0284C7',
  skatingSoft: '#E0F2FE',
  pool: '#0D9488',
  poolSoft: '#CCFBF1',
  sauna: '#D97706',
  saunaSoft: '#FEF3C7',
  cinema: '#4F46E5',
  cinemaSoft: '#E0E7FF',
  culture: '#E11D48',
  cultureSoft: '#FFE4E6',
  cities: {
    svetla: { fg: '#0369A1', bg: '#E0F2FE' },
    hb: { fg: '#0F766E', bg: '#CCFBF1' },
    ledec: { fg: '#B45309', bg: '#FEF3C7' },
    humpolec: { fg: '#6D28D9', bg: '#EDE9FE' },
  },
  live: '#059669',
  liveSoft: '#D1FAE5',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  tabBarBg: '#FFFFFF',
  shadow: '#0F172A',
};

export const darkTheme: AppTheme = {
  isDark: true,
  background: '#0B1120',
  surface: '#162033',
  surfaceSecondary: '#1E293B',
  border: '#263449',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#38BDF8',
  primarySoft: 'rgba(56, 189, 248, 0.16)',
  sport: '#2DD4BF',
  sportSoft: 'rgba(45, 212, 191, 0.16)',
  skating: '#38BDF8',
  skatingSoft: 'rgba(56, 189, 248, 0.16)',
  pool: '#2DD4BF',
  poolSoft: 'rgba(45, 212, 191, 0.16)',
  sauna: '#FBBF24',
  saunaSoft: 'rgba(251, 191, 36, 0.16)',
  cinema: '#818CF8',
  cinemaSoft: 'rgba(129, 140, 248, 0.18)',
  culture: '#FB7185',
  cultureSoft: 'rgba(251, 113, 133, 0.18)',
  cities: {
    svetla: { fg: '#38BDF8', bg: 'rgba(56, 189, 248, 0.18)' },
    hb: { fg: '#2DD4BF', bg: 'rgba(45, 212, 191, 0.18)' },
    ledec: { fg: '#FBBF24', bg: 'rgba(251, 191, 36, 0.18)' },
    humpolec: { fg: '#C084FC', bg: 'rgba(192, 132, 252, 0.18)' },
  },
  live: '#34D399',
  liveSoft: 'rgba(52, 211, 153, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.15)',
  tabBarBg: '#111827',
  shadow: '#000000',
};
