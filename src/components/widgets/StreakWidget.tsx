import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface StreakWidgetProps {
  streak: { current: number; best: number };
}

export default function StreakWidget({ streak }: StreakWidgetProps) {
  return (
    <View className="items-center py-2 gap-1">
      <Text className="text-xl font-black text-amber-400">{streak.current} Days</Text>
      <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Current Active Streak</Text>
      <Text className="text-[9px] text-slate-500 mt-1">Best streak: {streak.best} days</Text>
    </View>
  );
}
