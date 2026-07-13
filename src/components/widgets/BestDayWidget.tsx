import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { KPI, withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface BestDayData {
  day: number;
  label: string;
  avgEarnings: number;
}

interface BestDayWidgetProps {
  bestDayData: BestDayData[];
  maxDayAvg: number;
}

function MiniBar({ value, maxValue, color, height = 60 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const C = useColors();
  const barColor = color ?? C.success;
  const pct = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 8;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 2 }}>
      <View style={{ width: "100%", height: `${pct}%`, backgroundColor: barColor, borderTopLeftRadius: 8, borderTopRightRadius: 8, opacity: value > 0 ? 1 : 0.15 }} />
    </View>
  );
}

export default function BestDayWidget({ bestDayData, maxDayAvg }: BestDayWidgetProps) {
  const bestDay = bestDayData.reduce((p, c) => (p.avgEarnings > c.avgEarnings ? p : c), bestDayData[0]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
         <Text variant="labelM" className="text-content-secondary">Peak Performer</Text>
         <View style={{ backgroundColor: withAlpha(KPI.gross, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
           <Text variant="labelXs" style={{ color: KPI.gross }}>{bestDay?.label || ""}</Text>
         </View>
      </View>
      <View
        accessible={true}
        accessibilityLabel={`Average earnings by day of week. Best day ${bestDay?.label || "none"} at $${(bestDay?.avgEarnings || 0).toFixed(0)} average`}
        style={{ flexDirection: "row", alignItems: "flex-end", height: 60, marginTop: 8 }}
      >
        {bestDayData.map((d, i) => (
          <MiniBar key={i} value={d.avgEarnings} maxValue={maxDayAvg} color={d.label === bestDay?.label ? KPI.gross : withAlpha(KPI.gross, 0.38)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {bestDayData.map((d) => (
          <Text key={d.day} variant="labelXs" className="text-content-secondary" style={{ flex: 1, textAlign: "center" }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
