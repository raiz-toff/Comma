import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { PlatformBadge } from "../ui/PlatformBadge";
import { type PlatformKey } from "@/src/registry/platforms";

interface PlatformShare {
  platform: string;
  total: number;
  count: number;
  share: number;
}

interface PlatformActivityWidgetProps {
  platformData: PlatformShare[];
}

export default function PlatformActivityWidget({ platformData }: PlatformActivityWidgetProps) {
  const topPlatforms = platformData.slice(0, 3);

  return (
    <View className="gap-2">
      {topPlatforms.length === 0 ? (
        <Text className="text-[10px] text-slate-500 font-bold text-center py-2">No shift data found</Text>
      ) : (
        topPlatforms.map((p) => (
          <View key={p.platform} className="flex-row items-center justify-between">
            <PlatformBadge platform={p.platform as PlatformKey} size="sm" />
            <Text className="text-[10px] font-bold text-slate-300">{p.share.toFixed(0)}%</Text>
          </View>
        ))
      )}
    </View>
  );
}
