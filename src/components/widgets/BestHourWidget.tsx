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

function MiniBar({ value, maxValue, color = "#10b981", height = 45 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const pct = maxValue > 0 ? Math.max(3, (value / maxValue) * 100) : 3;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 }}>
      <View style={{ width: "80%", height: `${pct}%`, backgroundColor: color, borderRadius: 2, opacity: value > 0 ? 1 : 0.15 }} />
    </View>
  );
}

export default function BestHourWidget({ bestHourData, maxHourAvg }: BestHourWidgetProps) {
  const oddHours = bestHourData.filter((_, idx) => idx % 2 === 0);

  return (
    <View>
      <View className="flex-row items-end" style={{ height: 50 }}>
        {oddHours.map((h, i) => (
          <MiniBar key={i} value={h.avgEarnings} maxValue={maxHourAvg} color="#f59e0b" />
        ))}
      </View>
      <View className="flex-row justify-between mt-1 px-1">
        <Text className="text-[8px] text-slate-500 font-bold">12 AM</Text>
        <Text className="text-[8px] text-slate-500 font-bold">12 PM</Text>
        <Text className="text-[8px] text-slate-500 font-bold">11 PM</Text>
      </View>
    </View>
  );
}
