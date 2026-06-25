import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface BestHourData {
  hour: number;
  avgEarnings: number;
}

interface BestHourWidgetProps {
  bestHourData: BestHourData[];
  maxHourAvg: number;
}

function MiniBar({ value, maxValue, color = "#10b981", height = 60 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const pct = maxValue > 0 ? Math.max(8, (value / maxValue) * 100) : 8;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 }}>
      <View style={{ width: "100%", height: `${pct}%`, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: value > 0 ? 1 : 0.15 }} />
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
         <Text style={{ fontSize: 13, fontWeight: "600", color: "#a1a1aa" }}>Most Lucrative</Text>
         <View style={{ backgroundColor: "#f59e0b20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
           <Text style={{ fontSize: 11, fontWeight: "800", color: "#f59e0b" }}>{formatHour(bestHour?.hour || 0)}</Text>
         </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 60, marginTop: 8 }}>
        {oddHours.map((h, i) => (
          <MiniBar key={i} value={h.avgEarnings} maxValue={maxHourAvg} color={h.hour === bestHour?.hour ? "#f59e0b" : "#f59e0b60"} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: "800", color: "#71717a" }}>12 AM</Text>
        <Text style={{ fontSize: 9, fontWeight: "800", color: "#71717a" }}>12 PM</Text>
        <Text style={{ fontSize: 9, fontWeight: "800", color: "#71717a" }}>11 PM</Text>
      </View>
    </View>
  );
}
