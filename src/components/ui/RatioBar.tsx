import * as React from "react";
import { View } from "react-native";
import { cn } from "@/src/lib/utils";

export interface RatioBarSegment {
  value: number;
  color: string;
}

export interface RatioBarProps {
  segments: RatioBarSegment[];
  /**
   * "flex": value is a flex weight — segments divide the full bar width between
   * them (DeadMilesWidget-style split). "percent": value is a 0-100 width%,
   * with any remainder left showing the track color (single-ratio bars).
   */
  mode?: "flex" | "percent";
  /** Bar height in px — the codebase uses 4, 8, 10, and 12 depending on context. */
  height?: number;
  /** Flex-mode only: floor so a near-zero segment stays visible. Matches the
   * Math.max(0.01, x) guard every flex-mode bar in the codebase already used. */
  minFlex?: number;
  accessibilityLabel?: string;
  className?: string;
}

export function RatioBar({
  segments,
  mode = "flex",
  height = 12,
  minFlex = 0.01,
  accessibilityLabel,
  className,
}: RatioBarProps) {
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      // rounded-sm = this project's custom 8px radius (tailwind.config.js overrides the
      // stock scale) — matches every hand-rolled bar's original `borderRadius: 8` exactly.
      className={cn("flex-row overflow-hidden rounded-sm bg-surface-04", className)}
      style={{ height }}
    >
      {segments.map((segment, index) => (
        <View
          key={index}
          style={
            mode === "flex"
              ? { flex: Math.max(minFlex, segment.value), backgroundColor: segment.color }
              : { width: `${segment.value}%`, backgroundColor: segment.color }
          }
        />
      ))}
    </View>
  );
}
