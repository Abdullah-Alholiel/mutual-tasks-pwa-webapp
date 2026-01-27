// ============================================================================
// Project Color Migration Utilities
// ============================================================================
// Utilities for migrating project colors and ensuring data consistency
// ============================================================================

import { PROJECT_COLORS, DEFAULT_PROJECT_COLOR, type ProjectColor, isValidProjectColor } from '@/constants/projectColors';

const VALID_COLOR_VALUES = new Set(PROJECT_COLORS.map((c) => c.value));

export const migrateProjectColor = (color: string | null | undefined): ProjectColor => {
  if (!color) {
    return DEFAULT_PROJECT_COLOR;
  }

  if (isValidProjectColor(color)) {
    return color as ProjectColor;
  }

  console.warn(`Invalid project color "${color}", migrating to default blue`);
  return DEFAULT_PROJECT_COLOR;
};

export const migrateAllProjectColors = (colors: (string | null | undefined)[]): ProjectColor[] => {
  return colors.map((color) => migrateProjectColor(color));
};

export const getColorDisplayName = (color: string): string => {
  const found = PROJECT_COLORS.find((c) => c.value === color);
  if (found) return found.name;

  const normalizedColor = color.toLowerCase();
  const colorNameMap: Record<string, string> = {
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow',
    red: 'Red',
    purple: 'Purple',
    grey: 'Grey',
    darkgrey: 'Dark Grey',
    darkgray: 'Dark Grey',
    gray: 'Grey',
  };

  for (const [key, name] of Object.entries(colorNameMap)) {
    if (normalizedColor.includes(key)) {
      const projectColor = PROJECT_COLORS.find((c) => c.name === name);
      if (projectColor) return name;
    }
  }

  return 'Blue';
};

export const convertHslToHex = (hsl: string): ProjectColor | null => {
  const hslMap: Record<string, ProjectColor> = {
    'hsl(199, 89%, 48%)': '#1D4ED8',
    'hsl(142, 76%, 36%)': '#10B981',
    'hsl(32, 95%, 58%)': '#FCD34D',
    'hsl(280, 70%, 50%)': '#8B5CF6',
    'hsl(340, 75%, 55%)': '#EF4444',
    'hsl(180, 70%, 45%)': '#64748B',
  };

  return hslMap[hsl] || null;
};

export const normalizeLegacyColors = (color: string | null | undefined): ProjectColor => {
  if (!color) return DEFAULT_PROJECT_COLOR;

  if (isValidProjectColor(color)) return color as ProjectColor;

  if (color.startsWith('hsl')) {
    const converted = convertHslToHex(color);
    if (converted) return converted;
  }

  const normalized = getColorDisplayName(color);
  const projectColor = PROJECT_COLORS.find((c) => c.name === normalized);
  if (projectColor) return projectColor.value;

  return DEFAULT_PROJECT_COLOR;
};

export const COLOR_MIGRATION_SUMMARY = {
  legacyColors: ['hsl(199, 89%, 48%)', 'hsl(142, 76%, 36%)', 'hsl(32, 95%, 58%)', 'hsl(280, 70%, 50%)', 'hsl(340, 75%, 55%)', 'hsl(180, 70%, 45%)'],
  newColors: PROJECT_COLORS,
  defaultColor: DEFAULT_PROJECT_COLOR,
};
