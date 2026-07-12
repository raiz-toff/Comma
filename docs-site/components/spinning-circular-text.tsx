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
      <text className="fill-current font-mono text-[8.5px] font-medium uppercase tracking-[0.22em]">
        <textPath href="#circ-text-path">{text}</textPath>
      </text>
    </svg>
  );
}
