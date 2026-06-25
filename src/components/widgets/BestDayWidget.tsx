import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface BestDayData {
  day: number;
  label: string;
  avgEarnings: number;
}

interface BestDayWidgetProps {
  bestDayData: BestDayData[];
  maxDayAvg: number;
}

function MiniBar({ value, maxValue, color = "#10b981", height = 60 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const pct = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 8;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 2 }}>
      <View style={{ width: "100%", height: `${pct}%`, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: value > 0 ? 1 : 0.15 }} />
    </View>
  );
}

export default function BestDayWidget({ bestDayData, maxDayAvg }: BestDayWidgetProps) {
  const bestDay = bestDayData.reduce((p, c) => (p.avgEarnings > c.avgEarnings ? p : c), bestDayData[0]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
         <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Peak Performer</Text>
         <View style={{ backgroundColor: "#6366f120", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
           <Text style={{ fontSize: 11, fontWeight: "800", color: "#6366f1" }}>{bestDay?.label || ""}</Text>
         </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 60, marginTop: 8 }}>
        {bestDayData.map((d, i) => (
          <MiniBar key={i} value={d.avgEarnings} maxValue={maxDayAvg} color={d.label === bestDay?.label ? "#6366f1" : "#6366f160"} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {bestDayData.map((d) => (
          <Text key={d.day} style={{ fontSize: 9, fontWeight: "800", color: "#71717a", flex: 1, textAlign: "center" }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
