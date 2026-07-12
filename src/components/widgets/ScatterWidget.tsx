import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { Text } from "../ui/text";
import { KPI, withAlpha } from "@/src/theme/colors";
import { useColors, type Palette } from "@/src/theme/useColors";

interface ScatterPoint {
  x: number; // hours
  y: number; // gross earnings
}

interface ScatterWidgetProps {
  data: ScatterPoint[];
}

function calculateStatistics(data: ScatterPoint[]) {
  if (!data || data.length < 2) return { m: 0, b: 0, r: 0, valid: false };

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (const { x, y } of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { m: 0, b: 0, r: 0, valid: false };

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  const rNum = n * sumXY - sumX * sumY;
  const rDenom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const r = rDenom === 0 ? 0 : rNum / rDenom;

  return { m, b, r, valid: true };
}

function correlationTier(r: number, C: Palette): { label: string; color: string } {
  const abs = Math.abs(r);
  if (abs >= 0.7) return { label: r >= 0 ? "Strong positive correlation" : "Strong negative correlation", color: C.success };
  if (abs >= 0.4) return { label: r >= 0 ? "Moderate positive correlation" : "Moderate negative correlation", color: KPI.rate };
  return { label: "Weak correlation", color: C.contentMuted };
}

export default function ScatterWidget({ data }: ScatterWidgetProps) {
  const C = useColors();
  const points = useMemo(() => (data || []).filter((d) => d.x > 0 || d.y > 0), [data]);

  if (points.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24 }}>
        <Text variant="paragraphS">Awaiting shift data</Text>
      </View>
    );
  }

  const stats = calculateStatistics(points);
  const tier = correlationTier(stats.r, C);

  const svgW = 280;
  const svgH = 140;
  const padding = 8;
  const maxX = Math.max(...points.map((d) => d.x)) * 1.1 || 1;
  const maxY = Math.max(...points.map((d) => d.y)) * 1.1 || 1;

  const toPx = (x: number) => padding + (x / maxX) * (svgW - padding * 2);
  const toPy = (y: number) => svgH - padding - (y / maxY) * (svgH - padding * 2);

  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  const showLine = stats.valid;
  if (showLine) {
    x1 = 0;
    y1 = stats.b;
    x2 = maxX;
    y2 = stats.m * maxX + stats.b;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="labelM" tabular style={{ color: C.contentSecondary }}>{points.length} Shifts Analyzed</Text>
        <View style={{ backgroundColor: withAlpha(tier.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelXs" style={{ color: tier.color }}>{tier.label}</Text>
        </View>
      </View>

      <View
        accessible={true}
        accessibilityLabel={`Scatter chart of ${points.length} shifts, hours worked versus earnings. ${tier.label}.`}
        style={{ height: svgH, width: "100%" }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
          {showLine && (
            <Line
              x1={toPx(x1)}
              y1={toPy(Math.max(0, Math.min(maxY, y1)))}
              x2={toPx(x2)}
              y2={toPy(Math.max(0, Math.min(maxY, y2)))}
              stroke={KPI.gross}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          {points.map((p, i) => (
            <Circle key={i} cx={toPx(p.x)} cy={toPy(Math.min(maxY, p.y))} r={4} fill={KPI.gross} opacity={0.75} />
          ))}
        </Svg>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>0 hrs</Text>
        <Text variant="labelXs" tabular style={{ color: KPI.gross }}>r = {stats.r.toFixed(2)}</Text>
        <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>{maxX.toFixed(1)} hrs</Text>
      </View>
    </View>
  );
}
