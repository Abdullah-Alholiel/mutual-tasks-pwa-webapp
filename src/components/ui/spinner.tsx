// ============================================================================
// Spinner Component - Reusable inline loading spinner
// ============================================================================
// Consistent spinner using lucide-react Loader2 with standardized color
// Use for small loading states within buttons, cards, etc.
// ============================================================================

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_LOADER_COLOR } from '@/constants/loader';

interface SpinnerProps {
  /**
   * Size of the spinner (default: 16)
   */
  size?: number;
  /**
   * Color of the spinner (default: '#1D4ED8')
   */
  color?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Reusable Spinner Component
 * 
 * Usage examples:
 * ```tsx
 * // Basic usage
 * <Spinner />
 * 
 * // Custom size
 * <Spinner size={20} />
 * 
 * // Custom color
 * <Spinner color="#EF4444" />
 * ```
 */
export function Spinner({
  size = 16,
  color = DEFAULT_LOADER_COLOR,
  className,
}: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin', className)}
      size={size}
      style={{ color }}
    />
  );
}

/**
 * Button Spinner - Pre-configured spinner for loading buttons
 * 
 * Usage:
 * ```tsx
 * <Button disabled>
 *   <ButtonSpinner />
 *   Saving...
 * </Button>
 * ```
 */
export function ButtonSpinner({ className }: { className?: string }) {
  return <Spinner size={16} className={cn('mr-2', className)} />;
}

/**
 * Card Spinner - Pre-configured spinner for loading cards
 * 
 * Usage:
 * ```tsx
 * <Card>
 *   <CardContent>
 *     <CardSpinner />
 *   </CardContent>
 * </Card>
 * ```
 */
export function CardSpinner({ className }: { className?: string }) {
  return <Spinner size={24} className={className} />;
}

/**
 * Page Spinner - Pre-configured spinner for full page loading
 * 
 * Usage:
 * ```tsx
 * {isLoading && <PageSpinner />}
 * ```
 */
export function PageSpinner({ className }: { className?: string }) {
  return <Spinner size={32} className={className} />;
}
