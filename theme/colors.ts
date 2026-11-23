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
  skating: string;
  skatingSoft: string;
  pool: string;
  poolSoft: string;
  sauna: string;
  saunaSoft: string;
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
  skating: '#0284C7',
  skatingSoft: '#E0F2FE',
  pool: '#0D9488',
  poolSoft: '#CCFBF1',
  sauna: '#D97706',
  saunaSoft: '#FEF3C7',
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
  skating: '#38BDF8',
  skatingSoft: 'rgba(56, 189, 248, 0.16)',
  pool: '#2DD4BF',
  poolSoft: 'rgba(45, 212, 191, 0.16)',
  sauna: '#FBBF24',
  saunaSoft: 'rgba(251, 191, 36, 0.16)',
  live: '#34D399',
  liveSoft: 'rgba(52, 211, 153, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.15)',
  tabBarBg: '#111827',
  shadow: '#000000',
};
