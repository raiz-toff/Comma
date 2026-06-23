import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface DeadMilesWidgetProps {
  mileage: { active: number; dead: number; ratio: number } | undefined;
}

export default function DeadMilesWidget({ mileage }: DeadMilesWidgetProps) {
  const activeVal = mileage?.active || 0;
  const deadVal = mileage?.dead || 0;
  const ratioVal = mileage?.ratio || 0;

  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-emerald-400 font-bold">Active: {activeVal.toFixed(0)}</Text>
        <Text className="text-[10px] text-rose-400 font-bold">Dead: {deadVal.toFixed(0)}</Text>
      </View>
      <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex-row">
        <View style={{ flex: Math.max(0.01, activeVal), backgroundColor: "#10b981" }} />
        <View style={{ flex: Math.max(0.01, deadVal), backgroundColor: "#f43f5e" }} />
      </View>
      <Text className="text-[9px] text-slate-500 font-bold text-center">
        Dead Ratio: {ratioVal.toFixed(0)}%
      </Text>
    </View>
  );
}
