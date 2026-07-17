import * as React from "react";
import { View } from "react-native";
import { cn } from "@/src/lib/utils";

export interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <View className={cn("border-t border-line-subtle", className)} />;
}
