import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { PlatformBadge } from "../ui/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { useColors } from "@/src/theme/useColors";

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
  const C = useColors();
  const topPlatforms = platformData.slice(0, 3);

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      {topPlatforms.length === 0 ? (
        <Text variant="paragraphS" className="text-content-muted" style={{ textAlign: "center", marginVertical: 10 }}>No shift data found</Text>
      ) : (
        topPlatforms.map((p) => {
          const platformDef = PLATFORMS[p.platform as PlatformKey];
          const color = platformDef?.color || C.contentPrimary;

          return (
            <View key={p.platform} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <PlatformBadge platform={p.platform as PlatformKey} size="sm" />
                <Text variant="labelL" tabular>{p.share.toFixed(0)}%</Text>
              </View>
              <View
                accessible={true}
                accessibilityLabel={`${platformDef?.label || p.platform} ${p.share.toFixed(0)}% of earnings`}
                style={{ height: 8, backgroundColor: C.surface04, borderRadius: 8, overflow: "hidden" }}
              >
                <View style={{ height: "100%", width: `${p.share}%`, backgroundColor: color, borderRadius: 8 }} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
