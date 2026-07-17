import * as React from "react";
import { View } from "react-native";
import { cn } from "@/src/lib/utils";
import { withAlpha } from "@/src/theme/colors";
import { cva, type VariantProps } from "class-variance-authority";

type IconBadgeSize = "xs" | "sm" | "md" | "lg";

const iconBadgeVariants = cva("items-center justify-center", {
  variants: {
    tone: {
      tinted: "",
      neutral: "bg-surface-03 border border-line-subtle",
    },
    // NOTE: this project's tailwind.config.js overrides the border-radius scale
    // (sm=8px, md=12px, lg=16px, xl=20px, 2xl=28px) — do NOT assume stock Tailwind
    // values here. Each size below is picked to match its evidenced real pixel radius.
    size: {
      // Padding-based (not a fixed box) — matches the compact stat-card header
      // badge (analytics.tsx's PremiumStatCard/SwitchableStatCard: padding 6, radius 8).
      xs: "p-1.5 rounded-sm",
      sm: "w-8 h-8 rounded-md",
      md: "w-9 h-9 rounded-md",
      lg: "w-14 h-14 rounded-lg",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
  },
});

// Neutral/lg (EmptyState's icon box) is a bigger box + shallower radius than
// tinted/lg's padding-derived shape — the two tones never shared a box at "lg".
const NEUTRAL_LG_OVERRIDE = "w-16 h-16 rounded-lg";

const DEFAULT_ICON_SIZE: Record<IconBadgeSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 32,
};

export interface IconBadgeProps {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Resolved token color (KPI.*, theme accentColor, C.contentMuted, …) — never a literal hex. */
  color: string;
  tone?: VariantProps<typeof iconBadgeVariants>["tone"];
  size?: IconBadgeSize;
  iconSize?: number;
  strokeWidth?: number;
  className?: string;
}

export function IconBadge({
  icon: Icon,
  color,
  tone = "neutral",
  size = "md",
  iconSize,
  strokeWidth = 2,
  className,
}: IconBadgeProps) {
  return (
    <View
      className={cn(
        iconBadgeVariants({ tone, size }),
        tone === "neutral" && size === "lg" && NEUTRAL_LG_OVERRIDE,
        className
      )}
      style={tone === "tinted" ? { backgroundColor: withAlpha(color, 0.12) } : undefined}
    >
      <Icon size={iconSize ?? DEFAULT_ICON_SIZE[size]} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
