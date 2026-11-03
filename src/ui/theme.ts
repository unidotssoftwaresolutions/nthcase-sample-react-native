import { createContext, useContext } from 'react';
import { Platform, type TextStyle } from 'react-native';

import { type CategoryKey } from '../data/catalog';

/**
 * The Mossgrove palette (SPEC.md §10, DESIGN.md): cabinet-enamel green, cool card-stock neutrals, and one brass accent
 * kept for the item number, Add to cart and the cart badge. Fixed values: no dynamic colour, so all five apps and
 * every screenshot look the same.
 */
export type Palette = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  scrim: string;
};

export const LIGHT: Palette = {
  primary: '#2E5E55', onPrimary: '#FFFFFF',
  primaryContainer: '#CBE7DF', onPrimaryContainer: '#0B2B25',
  secondary: '#4F615C', onSecondary: '#FFFFFF',
  secondaryContainer: '#D2E5DF', onSecondaryContainer: '#0C1F1B',
  tertiary: '#7A5A1C', onTertiary: '#FFFFFF',
  tertiaryContainer: '#FCDFA6', onTertiaryContainer: '#271900',
  error: '#BA1A1A', onError: '#FFFFFF',
  surface: '#F7F9F7', onSurface: '#181C1B',
  surfaceVariant: '#DBE5E1', onSurfaceVariant: '#3F4946',
  outline: '#6F7976', outlineVariant: '#BFC9C5',
  surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F1F4F2', surfaceContainer: '#EBEFEC',
  surfaceContainerHigh: '#E5E9E6', surfaceContainerHighest: '#E0E3E1',
  inverseSurface: '#2D3130', inverseOnSurface: '#EFF1EF', inversePrimary: '#95D1C2',
  scrim: 'rgba(0,0,0,0.32)',
};

export const DARK: Palette = {
  primary: '#95D1C2', onPrimary: '#003730',
  primaryContainer: '#15493F', onPrimaryContainer: '#B0EEDD',
  secondary: '#B6CBC4', onSecondary: '#21352F',
  secondaryContainer: '#374B45', onSecondaryContainer: '#D2E7E0',
  tertiary: '#EEC06E', onTertiary: '#412D00',
  tertiaryContainer: '#5D4200', onTertiaryContainer: '#FFDEA5',
  error: '#FFB4AB', onError: '#690005',
  surface: '#101413', onSurface: '#E0E3E1',
  surfaceVariant: '#3F4946', onSurfaceVariant: '#BFC9C5',
  outline: '#899390', outlineVariant: '#3F4946',
  surfaceContainerLowest: '#0B0F0E', surfaceContainerLow: '#181C1B', surfaceContainer: '#1C2120',
  surfaceContainerHigh: '#272B2A', surfaceContainerHighest: '#313635',
  inverseSurface: '#E0E3E1', inverseOnSurface: '#2D3130', inversePrimary: '#2E5E55',
  scrim: 'rgba(0,0,0,0.5)',
};

/** One tint pair per aisle: the tile behind an item's glyph, and the glyph's ink. */
export type AisleTint = { tile: string; ink: string };

export const LIGHT_AISLES: Record<CategoryKey, AisleTint> = {
  kitchen: { tile: '#DDEBE5', ink: '#2E5E55' },
  desk: { tile: '#E2E7EE', ink: '#3F5466' },
  garden: { tile: '#DCEBD3', ink: '#3E6A2E' },
  home: { tile: '#E8E4DE', ink: '#5B5148' },
};

export const DARK_AISLES: Record<CategoryKey, AisleTint> = {
  kitchen: { tile: '#23332E', ink: '#95D1C2' },
  desk: { tile: '#222A33', ink: '#B4C5D8' },
  garden: { tile: '#263322', ink: '#A8D493' },
  home: { tile: '#302D29', ink: '#D3C7BA' },
};

export type Theme = { dark: boolean; colors: Palette; aisles: Record<CategoryKey, AisleTint> };

export const LIGHT_THEME: Theme = { dark: false, colors: LIGHT, aisles: LIGHT_AISLES };
export const DARK_THEME: Theme = { dark: true, colors: DARK, aisles: DARK_AISLES };

export const ThemeContext = createContext<Theme>(LIGHT_THEME);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** The system face in Material's type scale (DESIGN.md §Typography). Sizes follow the system font scale. */
export const Type = {
  display: { fontSize: 36, lineHeight: 44, fontWeight: '400' },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '400' },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

/** The system monospace face: item numbers and the printed test account only (the Stamped Number Rule). */
export const MONOSPACE = Platform.select({ ios: 'ui-monospace', default: 'monospace' });

export const ItemNumberStyle: TextStyle = { fontFamily: MONOSPACE, fontSize: 13, fontWeight: '500', letterSpacing: 0.5 };

/** One corner scale (DESIGN.md §Shapes). */
export const Radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 9999 } as const;

/** A 4 dp grid. */
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, touch: 48 } as const;
