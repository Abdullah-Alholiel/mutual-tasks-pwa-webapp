// ============================================================================
// Project Constants - Single Source of Truth
// ============================================================================
// All project-related constants should be defined here for easy maintenance
// and consistent usage across the application
// ============================================================================

export const PROJECT_COLORS = [
  { name: 'Blue', value: '#1D4ED8' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#FCD34D' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Grey', value: '#64748B' },
  { name: 'Dark Grey', value: '#1E293B' },
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number]['value'];

export const DEFAULT_PROJECT_COLOR: ProjectColor = PROJECT_COLORS[0].value;

export const isValidProjectColor = (color: string): color is ProjectColor => {
  return PROJECT_COLORS.some((c) => c.value === color);
};

export const getProjectColorByName = (name: string): ProjectColor | undefined => {
  return PROJECT_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.value;
};

export const getProjectColorName = (color: string): string => {
  return PROJECT_COLORS.find((c) => c.value === color)?.name || 'Blue';
};
