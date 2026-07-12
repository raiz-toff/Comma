'use client';

import { useTheme } from 'next-themes';
import { DotGridSpotlight } from '@/components/dot-grid-spotlight';

const DOT_COLOR = {
  light: {
    default: 'rgba(0, 0, 0, 0.05)',
    active: 'rgba(16, 185, 129, 0.5)',
  },
  dark: {
    default: 'rgba(255, 255, 255, 0.04)',
    active: 'rgba(52, 211, 153, 0.45)',
  },
} as const;

// Theme-aware spotlight layer for the hero shift receipt. Masked to the card's
// edges so the dots never sit under the text — near-invisible at rest, they
// light up along the border as the cursor moves.
export function ReceiptSpotlight() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <DotGridSpotlight
      dotColor={DOT_COLOR[theme].default}
      activeDotColor={DOT_COLOR[theme].active}
      gap={12}
      dotRadius={1}
      spotlightRadius={90}
      className="[mask-image:radial-gradient(140%_120%_at_50%_45%,transparent_52%,#000_78%)]"
    />
  );
}
