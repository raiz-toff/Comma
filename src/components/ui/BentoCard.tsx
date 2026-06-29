import * as React from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";

export interface BentoCardProps {
  size: "1x1" | "2x1" | "1x2" | "2x2";
  title?: string;
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accentColor?: string;
  className?: string;
}

export function BentoCard({
  size,
  title,
  children,
  onPress,
  accentColor,
  className,
}: BentoCardProps) {
  const CardComponent = onPress ? Pressable : View;

  const sizeClasses = {
    "1x1": "w-1/2",
    "2x1": "w-full",
    "1x2": "w-1/2 h-auto min-h-[160px]",
    "2x2": "w-full",
  };

  return (
    <CardComponent
      onPress={onPress}
      className={cn(
        "border border-line-subtle bg-card rounded-lg p-4 flex flex-col justify-between overflow-hidden",
        sizeClasses[size],
        className
      )}
      style={accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined}
    >
      <View className="flex-1 flex-col">
        {title && (
          <Text variant="labelXs" className="text-content-muted mb-2">
            {title}
          </Text>
        )}
        <View className="flex-1">
          {children}
        </View>
      </View>
    </CardComponent>
  );
}
