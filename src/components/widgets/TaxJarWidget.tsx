import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

interface TaxJarWidgetProps {
  taxWithholdingPct: number;
}

export default function TaxJarWidget({ taxWithholdingPct }: TaxJarWidgetProps) {
  return (
    <View className="items-center py-1 gap-1">
      <View className="w-12 h-12 rounded-full border-2 border-emerald-500/20 items-center justify-center">
        <Text className="text-xs font-black text-slate-200">{taxWithholdingPct}%</Text>
      </View>
      <Text className="text-[9px] font-bold text-slate-500 uppercase mt-1">WITHHOLDING TARGET</Text>
    </View>
  );
}
