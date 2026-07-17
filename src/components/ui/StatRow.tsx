import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";

export interface StatRowProps {
  label: string;
  value: string | number;
  /** Renders an 8px dot before the label — the legend-row look (e.g. "Active mi" beside a progress bar). */
  dotColor?: string;
  /** Trailing unit rendered in a smaller, muted style after the value (e.g. "mi", "hrs"). */
  unit?: string;
  valueColor?: string;
  /** Summary/total-row look: labelXs + muted text, vs. the default legend-row labelM + secondary text. */
  muted?: boolean;
  tabular?: boolean;
  className?: string;
}

export function StatRow({
  label,
  value,
  dotColor,
  unit,
  valueColor,
  muted = false,
  tabular = true,
  className,
}: StatRowProps) {
  return (
    <View className={cn("flex-row items-center justify-between", className)}>
      <View className="flex-row items-center gap-1.5">
        {dotColor && <View className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />}
        <Text variant={muted ? "labelXs" : "labelM"} className={muted ? "text-content-muted" : "text-content-secondary"}>
          {label}
        </Text>
      </View>
      <Text variant="labelM" tabular={tabular} style={valueColor ? { color: valueColor } : undefined}>
        {value}
        {unit && (
          <Text variant="paragraphS" className="text-content-secondary">
            {" "}
            {unit}
          </Text>
        )}
      </Text>
    </View>
  );
}
