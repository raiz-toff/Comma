import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { Text } from "../ui/text";
import { COLORS, KPI, TIERS, withAlpha } from "@/src/theme/colors";

interface StabilityScoreWidgetProps {
  score: number;
  weeklyGross: number[];
}

function tierFor(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Highly Stable", color: TIERS.elite };
  if (score >= 45) return { label: "Moderate Variance", color: TIERS.pro };
  return { label: "Highly Volatile", color: COLORS.destructive };
}

export default function StabilityScoreWidget({ score, weeklyGross }: StabilityScoreWidgetProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score || 0)));
  const tier = tierFor(clampedScore);
  const points = weeklyGross && weeklyGross.length >= 2 ? weeklyGross : [0, 0];

  const width = 100;
  const height = 40;
  const PAD = 3; // headroom so a peak/trough point's circle (r=2.5) never sits exactly on the SVG edge and gets clipped
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = PAD + (height - 2 * PAD) - ((v - min) / range) * (height - 2 * PAD);
    return { x, y };
  });

  const pathD = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <View style={{ gap: 16 }}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text variant="headingXl" tabular style={{ color: tier.color, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{clampedScore}</Text>
          <Text variant="labelM" tabular style={{ color: COLORS.contentSecondary, includeFontPadding: false }}>/ 100</Text>
        </View>
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text variant="labelXs" style={{ color: tier.color }}>{tier.label}</Text>
          </View>
        </View>
      </View>

      <View
        accessible={true}
        accessibilityLabel={`Stability score ${clampedScore} of 100, ${tier.label}. Weekly gross trend sparkline, all-time.`}
        style={{ height: 50 }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="stab-grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={KPI.gross} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={KPI.gross} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={areaD} fill="url(#stab-grad)" />
          <Path d={pathD} fill="none" stroke={KPI.gross} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {last && <Circle cx={last.x} cy={last.y} r={2.5} fill={KPI.gross} />}
        </Svg>
      </View>
      <Text variant="labelXs" style={{ color: COLORS.contentMuted }}>
        Weekly gross trend, all-time
      </Text>
    </View>
  );
}
