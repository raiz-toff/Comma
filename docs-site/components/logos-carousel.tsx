import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Infinite logo carousel. Pure CSS (keyframes in app/global.css): the track
// holds two copies of the children and translates by exactly one copy width
// for a seamless loop. Pauses on hover; with prefers-reduced-motion it renders
// as a static, scrollable strip.
export function LogosCarousel({
  children,
  className,
  duration = 28,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds for one full loop. */
  duration?: number;
}) {
  const row = (hidden?: boolean) => (
    <div
      style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}
      className="gap-16 pr-16"
      aria-hidden={hidden}
    >
      {children}
    </div>
  );

  return (
    <div className={cn('marquee', className)}>
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {row()}
        {row(true)}
      </div>
    </div>
  );
}
