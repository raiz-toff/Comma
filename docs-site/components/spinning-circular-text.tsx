import { cn } from '@/lib/cn';

// Text set on a circle, spinning slowly. Pure SVG + CSS (the .circ-spin
// keyframes live in app/global.css and stop under prefers-reduced-motion).
export function SpinningCircularText({
  text,
  className,
  duration = 18,
  size = 120,
}: {
  text: string;
  className?: string;
  /** Seconds per revolution. */
  duration?: number;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      className={cn('circ-spin select-none', className)}
      style={{ animationDuration: `${duration}s` }}
    >
      <defs>
        <path id="circ-text-path" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      {/* textLength pins the text to the exact circumference (2πr, r=38) so the
          seam never overlaps or gaps regardless of the string. */}
      <text className="fill-current font-mono text-[8px] font-medium uppercase">
        <textPath href="#circ-text-path" textLength={238.6} lengthAdjust="spacingAndGlyphs">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
