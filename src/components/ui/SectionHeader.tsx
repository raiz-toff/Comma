import * as React from "react";
import { View, Pressable } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";

export interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  className?: string;
}

export function SectionHeader({
  title,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between py-2 mb-3",
        className
      )}
    >
      <Text variant="headingL" className="text-content-primary tracking-tight">
        {title}
      </Text>

      {action && (
        <Pressable
          onPress={action.onPress}
          className="active:opacity-70 px-2 py-1 -mr-2"
        >
          <Text variant="labelXs" className="text-primary">
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
