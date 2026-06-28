import * as React from "react";
import { View, Text } from "react-native";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { PlatformLogo } from "@/src/components/GlobalTopHeader";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface PlatformBadgeProps {
  platform: PlatformKey;
  size?: "sm" | "md";
  style?: any;
  className?: string;
}

const HAS_LOGO = ["doordash", "ubereats", "instacart", "skip", "amazonflex", "amazon", "foodora", "lyft"];

export function PlatformBadge({ platform, size = "md", style, className }: PlatformBadgeProps) {
  if (typeof platform === "string" && platform.includes(",")) {
    const parts = platform.split(",");
    return (
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {parts.map((p) => (
          <PlatformBadge key={p} platform={p.trim() as PlatformKey} size={size} style={style} className={className} />
        ))}
      </View>
    );
  }

  const dbPlatforms = useSettingsStore((state) => state.dbPlatforms || []);
  const dbPlatform = dbPlatforms.find(p => p.id === platform);

  const config = {
    label: dbPlatform?.label || PLATFORMS[platform]?.label || platform,
    color: dbPlatform?.color || PLATFORMS[platform]?.color || PLATFORMS.other.color,
    textColor: dbPlatform?.textColor || PLATFORMS[platform]?.textColor || PLATFORMS.other.textColor,
    logoEmoji: dbPlatform?.logoEmoji || null,
  };

  const hasLogo = HAS_LOGO.includes(platform) && !config.logoEmoji;

  if (hasLogo) {
    const logoSize = size === "sm" ? 16 : 22;
    return (
      <View style={[{ justifyContent: "center", alignItems: "center" }, style]}>
        <PlatformLogo id={platform} size={logoSize} />
      </View>
    );
  }

  const emojiSize = size === "sm" ? 12 : 15;

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
          gap: config.logoEmoji ? 4 : 0,
        },
        style
      ]}
    >
      {config.logoEmoji ? (
        <Text style={{ fontSize: emojiSize, marginRight: 2 }}>{config.logoEmoji}</Text>
      ) : null}
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
