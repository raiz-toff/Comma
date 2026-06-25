import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { PlatformBadge } from "../ui/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";

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
    <View style={{ gap: 16, paddingTop: 4 }}>
      {topPlatforms.length === 0 ? (
        <Text style={{ fontSize: 13, color: "#71717a", textAlign: "center", fontStyle: "italic", marginVertical: 10 }}>No shift data found</Text>
      ) : (
        topPlatforms.map((p) => {
          const platformDef = PLATFORMS[p.platform as PlatformKey];
          const color = platformDef?.color || "#ffffff";
          
          return (
            <View key={p.platform} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <PlatformBadge platform={p.platform as PlatformKey} size="sm" />
                <Text style={{ fontSize: 15, fontWeight: "900", color: "#ffffff" }}>{p.share.toFixed(0)}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: "#262522", borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${p.share}%`, backgroundColor: color, borderRadius: 4 }} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
