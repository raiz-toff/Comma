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

function MiniBar({ value, maxValue, color = "#10b981", height = 45 }: { value: number; maxValue: number; color?: string; height?: number }) {
  const pct = maxValue > 0 ? Math.max(3, (value / maxValue) * 100) : 3;
  return (
    <View style={{ flex: 1, height, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 }}>
      <View style={{ width: "80%", height: `${pct}%`, backgroundColor: color, borderRadius: 2, opacity: value > 0 ? 1 : 0.15 }} />
    </View>
  );
}

export default function BestDayWidget({ bestDayData, maxDayAvg }: BestDayWidgetProps) {
  return (
    <View>
      <View className="flex-row items-end" style={{ height: 50 }}>
        {bestDayData.map((d, i) => (
          <MiniBar key={i} value={d.avgEarnings} maxValue={maxDayAvg} color="#6366f1" />
        ))}
      </View>
      <View className="flex-row justify-between mt-1">
        {bestDayData.map((d) => (
          <Text key={d.day} className="text-[8px] text-slate-500 font-black flex-1 text-center">
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
