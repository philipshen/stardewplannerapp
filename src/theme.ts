import { Platform } from 'react-native';

/** Warm, cozy farm palette (original). */
export const C = {
  wood: '#6b3d22',
  woodDark: '#4a2614',
  woodLight: '#8a5530',
  parchment: '#f6dca4',
  parchmentLight: '#fff1c8',
  parchmentDark: '#e2b878',
  parchmentShadow: '#c08850',
  ink: '#3b1f0f',
  inkSoft: '#6e4426',
  outline: '#2a140a',
  green: '#5aa83a',
  greenDark: '#3a7a24',
  greenLight: '#86d05a',
  orange: '#e0782a',
  orangeDark: '#a8501a',
  red: '#c83a3a',
  redDark: '#8a2222',
  blue: '#3a72c8',
  blueDark: '#24508e',
  gold: '#e8b830',
  sky: '#8fd0f4',
  white: '#fffaf0',
  overlay: 'rgba(30, 14, 6, 0.55)',
};

export const F = {
  regular: 'PixelifySans_400Regular',
  medium: 'PixelifySans_500Medium',
  semibold: 'PixelifySans_600SemiBold',
  bold: 'PixelifySans_700Bold',
  mono: 'VT323_400Regular',
};

export const shadow = Platform.select({
  web: { boxShadow: '0px 3px 0px rgba(42,20,10,0.35)' } as object,
  default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
});

export const SEASON_META = {
  spring: { label: 'Spring', color: '#5ab83a' },
  summer: { label: 'Summer', color: '#e8b830' },
  fall: { label: 'Fall', color: '#d0782a' },
  winter: { label: 'Winter', color: '#6aa8d8' },
} as const;
export type Season = keyof typeof SEASON_META;
export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
