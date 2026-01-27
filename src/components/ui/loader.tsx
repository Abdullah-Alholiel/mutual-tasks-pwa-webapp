// ============================================================================
// Loader Component - Reusable Helix Loader
// ============================================================================
// Professional, modular loader component using ldrs Helix
// Use throughout the application for consistent loading states
// ============================================================================

import { Helix } from 'ldrs/react';
import 'ldrs/react/Helix.css';
import { cn } from '@/lib/utils';
import { DEFAULT_LOADER_COLOR } from '@/constants/loader';

interface LoaderProps {
  /**
   * Size of the loader (default: 45)
   */
  size?: number | string;
  /**
   * Speed of the animation (default: 2.5)
   */
  speed?: number;
  /**
   * Color of the loader (default: '#1D4ED8' - primary theme color)
   * Can be any valid CSS color value
   */
  color?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Optional text to display below the loader
   */
  text?: string;
  /**
   * Whether to show full screen loader (default: false)
   */
  fullScreen?: boolean;
  /**
   * Custom container height (default: 'h-64' for inline, 'min-h-[100dvh] min-h-screen' for fullScreen)
   */
  containerHeight?: string;
}

/**
 * Reusable Loader Component
 * 
 * Usage examples:
 * ```tsx
 * // Basic usage
 * <Loader />
 * 
 * // With custom color
 * <Loader color="rgb(59, 130, 246)" />
 * 
 * // With text
 * <Loader text="Loading data..." />
 * 
 * // Full screen
 * <Loader fullScreen text="Loading..." />
 * 
 * // Custom size and speed
 * <Loader size={60} speed={3} />
 * ```
 */
export function Loader({
  size = 45,
  speed = 2.5,
  color = DEFAULT_LOADER_COLOR,
  className,
  text,
  fullScreen = false,
  containerHeight,
}: LoaderProps) {
  const defaultHeight = fullScreen ? 'min-h-[100dvh] min-h-screen' : 'h-64';
  const height = containerHeight || defaultHeight;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        height,
        fullScreen && 'w-full bg-background',
        className
      )}
    >
      <Helix size={size} speed={speed} color={color} />
      {text && (
        <p className="mt-4 text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

/**
 * Page Loader - Full screen loader for page-level loading states
 * 
 * Usage:
 * ```tsx
 * if (loading) return <PageLoader text="Loading page..." />;
 * ```
 */
export function PageLoader({ text, ...props }: Omit<LoaderProps, 'fullScreen'>) {
  return <Loader fullScreen text={text} {...props} />;
}

/**
 * Inline Loader - Compact loader for inline loading states
 * 
 * Usage:
 * ```tsx
 * {isLoading && <InlineLoader text="Loading..." />}
 * ```
 */
export function InlineLoader({ text, ...props }: Omit<LoaderProps, 'fullScreen'>) {
  return <Loader text={text} {...props} />;
}
