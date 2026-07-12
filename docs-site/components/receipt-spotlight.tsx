'use client';

import { useTheme } from 'next-themes';
import { DotGridSpotlight } from '@/components/dot-grid-spotlight';

const DOT_COLOR = {
  light: {
    default: 'rgba(0, 0, 0, 0.08)',
    active: 'rgba(16, 185, 129, 0.45)',
  },
  dark: {
    default: 'rgba(255, 255, 255, 0.06)',
    active: 'rgba(52, 211, 153, 0.4)',
  },
} as const;

// Theme-aware spotlight layer for the hero shift receipt.
export function ReceiptSpotlight() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <DotGridSpotlight
      dotColor={DOT_COLOR[theme].default}
      activeDotColor={DOT_COLOR[theme].active}
    />
  );
}
