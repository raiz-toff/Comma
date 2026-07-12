import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { COLORS, KPI, withAlpha } from "@/src/theme/colors";

interface BestHourData {
  hour: number;
  avgEarnings: number;
}

interface BestHourWidgetProps {
  bestHourData: BestHourData[];
  maxHourAvg: number;
}

function MiniBar({ value, maxValue, color = COLORS.success, height = 60 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const pct = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 8;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 }}>
      <View style={{ width: "100%", height: `${pct}%`, backgroundColor: color, borderTopLeftRadius: 8, borderTopRightRadius: 8, opacity: value > 0 ? 1 : 0.15 }} />
    </View>
  );
}

export default function BestHourWidget({ bestHourData, maxHourAvg }: BestHourWidgetProps) {
  const oddHours = bestHourData.filter((_, idx) => idx % 2 === 0);
  const bestHour = bestHourData.reduce((p, c) => (p.avgEarnings > c.avgEarnings ? p : c), bestHourData[0]);

  const formatHour = (h: number) => h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
         <Text variant="labelM" className="text-content-secondary">Most Lucrative</Text>
         <View style={{ backgroundColor: withAlpha(KPI.gross, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
           <Text variant="labelXs" style={{ color: KPI.gross }}>{formatHour(bestHour?.hour || 0)}</Text>
         </View>
      </View>
      <View
        accessible={true}
        accessibilityLabel={`Average earnings by hour of day. Best hour ${formatHour(bestHour?.hour || 0)} at $${(bestHour?.avgEarnings || 0).toFixed(0)} average`}
        style={{ flexDirection: "row", alignItems: "flex-end", height: 60, marginTop: 8 }}
      >
        {oddHours.map((h, i) => (
          <MiniBar key={i} value={h.avgEarnings} maxValue={maxHourAvg} color={h.hour === bestHour?.hour ? KPI.gross : withAlpha(KPI.gross, 0.38)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 4 }}>
        <Text variant="labelXs" className="text-content-secondary">12 AM</Text>
        <Text variant="labelXs" className="text-content-secondary">12 PM</Text>
        <Text variant="labelXs" className="text-content-secondary">11 PM</Text>
      </View>
    </View>
  );
}
