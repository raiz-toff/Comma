import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";

export interface PlatformBadgeProps {
  platform: PlatformKey;
  size?: "sm" | "md";
  className?: string;
}

export function PlatformBadge({ platform, size = "md", className }: PlatformBadgeProps) {
  const config = PLATFORMS[platform] || PLATFORMS.other;

  const sizeClasses = {
    sm: "px-2 py-0.5 rounded-full",
    md: "px-3 py-1 rounded-full",
  };

  const textClasses = {
    sm: "text-[10px] font-extrabold uppercase tracking-wider",
    md: "text-xs font-bold uppercase tracking-wider",
  };

  return (
    <View
      className={cn(
        "flex-row items-center justify-center self-start",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: config.color }}
    >
      <Text
        style={{ color: config.textColor }}
        className={cn(textClasses[size])}
      >
        {config.label}
      </Text>
    </View>
  );
}
