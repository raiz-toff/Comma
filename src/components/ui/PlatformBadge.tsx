import * as React from "react";
import { View, Text } from "react-native";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { PlatformLogo } from "@/src/components/GlobalTopHeader";

export interface PlatformBadgeProps {
  platform: PlatformKey;
  size?: "sm" | "md";
  style?: any;
  className?: string;
}

const HAS_LOGO = ["doordash", "ubereats", "instacart", "skip", "amazonflex", "amazon", "foodora", "lyft"];

export function PlatformBadge({ platform, size = "md", style }: PlatformBadgeProps) {
  const config = PLATFORMS[platform] || PLATFORMS.other;
  const hasLogo = HAS_LOGO.includes(platform);

  if (hasLogo) {
    const logoSize = size === "sm" ? 16 : 22;
    return (
      <View style={[{ justifyContent: "center", alignItems: "center" }, style]}>
        <PlatformLogo id={platform} size={logoSize} />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          backgroundColor: config.color,
          paddingHorizontal: size === "sm" ? 8 : 12,
          paddingVertical: size === "sm" ? 2 : 4,
          borderRadius: 999,
        },
        style
      ]}
    >
      <Text
        style={{
          color: config.textColor,
          fontSize: size === "sm" ? 10 : 12,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
