import React from "react";
import Svg, { Path, Rect, Line, Circle, Polyline } from "react-native-svg";
import { getColors } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface IconProps {
  size?: number;
  color?: string;
}

const sw = "1.5"; // strokeWidth
const common = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// ── Fuel / Gas Pump ──────────────────────────────────────────────────────────
const Fuel = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Line x1="3" x2="15" y1="22" y2="22" />
    <Line x1="4" x2="14" y1="9" y2="9" />
    <Path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
    <Path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
  </Svg>
);

// ── Maintenance / Wrench ─────────────────────────────────────────────────────
const Maintenance = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Svg>
);

// ── Insurance / Shield Check ─────────────────────────────────────────────────
const Insurance = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <Path d="m9 12 2 2 4-4" />
  </Svg>
);

// ── Licensing / ID Card ──────────────────────────────────────────────────────
const Licensing = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Rect width="20" height="14" x="2" y="5" rx="2" />
    <Circle cx="8" cy="12" r="2" />
    <Path d="M14 11h4M14 15h2" />
  </Svg>
);

// ── Interest / Trending Up ───────────────────────────────────────────────────
const Interest = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <Polyline points="16 7 22 7 22 13" />
  </Svg>
);

// ── Leasing / Key ────────────────────────────────────────────────────────────
const Leasing = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </Svg>
);

// ── Fees & Dues / Receipt ────────────────────────────────────────────────────
const Fees = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <Path d="M14 8H8" />
    <Path d="M16 12H8" />
    <Path d="M13 16H8" />
  </Svg>
);

// ── Phone / Smartphone ───────────────────────────────────────────────────────
const Phone = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <Path d="M12 18h.01" />
  </Svg>
);

// ── Supplies / Package ───────────────────────────────────────────────────────
const Supplies = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="m7.5 4.27 9 5.15" />
    <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <Path d="m3.3 7 8.7 5 8.7-5" />
    <Path d="M12 22V12" />
  </Svg>
);

// ── Wash / Water Drop ────────────────────────────────────────────────────────
const Wash = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <Path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
  </Svg>
);

// ── Parking / P Badge ────────────────────────────────────────────────────────
const Parking = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Rect width="18" height="18" x="3" y="3" rx="2" />
    <Path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </Svg>
);

// ── Other / More Horizontal ──────────────────────────────────────────────────
const Other = ({ size = 24, color = getColors().contentSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...common} stroke={color} strokeWidth={sw}>
    <Circle cx="12" cy="12" r="1" />
    <Circle cx="19" cy="12" r="1" />
    <Circle cx="5" cy="12" r="1" />
  </Svg>
);

// ── Registry ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  fuel:        Fuel,
  maintenance: Maintenance,
  insurance:   Insurance,
  licensing:   Licensing,
  interest:    Interest,
  leasing:     Leasing,
  fees:        Fees,
  phone:       Phone,
  supplies:    Supplies,
  wash:        Wash,
  parking:     Parking,
  other:       Other,
};

interface ExpenseCategoryIconProps {
  id: string;
  size?: number;
  color?: string;
}

export function ExpenseCategoryIcon({ id, size = 22, color }: ExpenseCategoryIconProps) {
  const C = useColors();
  const Icon = ICON_MAP[id] ?? Other;
  return <Icon size={size} color={color ?? C.contentSecondary} />;
}
