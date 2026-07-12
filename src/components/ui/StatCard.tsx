import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";
import { lucideIconMap } from "./lucideIconMap";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

export interface StatCardProps {
  icon: string | React.ComponentType<any>;
  label: string;
  value: string | number;
  delta?: number; // % vs last period
  className?: string;
}

const iconMapping: Record<string, keyof typeof lucideIconMap> = {
  home: "Home",
  clock: "Clock",
  "clock-play": "Clock",
  "chart-bar": "BarChart3",
  receipt: "Receipt",
  calculator: "Calculator",
  dots: "MoreHorizontal",
  car: "Car",
  target: "Target",
  calendar: "Calendar",
  settings: "Settings",
  info: "Info",
  "gas-station": "Fuel",
  tool: "Wrench",
  "device-mobile": "Phone",
  shield: "Shield",
  "shopping-bag": "ShoppingBag",
  parking: "ParkingSquare",
};

const mapIconName = (name: string): React.ComponentType<any> | null => {
  const cleanName = name.replace(/^ti-/, "").toLowerCase();
  const lucideKey = iconMapping[cleanName];
  if (lucideKey && lucideIconMap[lucideKey]) {
    return lucideIconMap[lucideKey] as React.ComponentType<any>;
  }

  // Try direct lookup with casing
  const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  if (lucideIconMap[capitalized]) {
    return lucideIconMap[capitalized] as React.ComponentType<any>;
  }

  // Fallback
  if (__DEV__) {
    console.warn(`StatCard: unknown icon "${name}", falling back to Info`);
  }
  return lucideIconMap.Info as React.ComponentType<any>;
};

export function StatCard({
  icon,
  label,
  value,
  delta,
  className,
}: StatCardProps) {
  // Resolve icon component
  const IconComponent = typeof icon === "string" ? mapIconName(icon) : icon;
  const { accentColor } = usePlatformTheme();

  return (
    <View
      className={cn(
        "border border-line-subtle bg-card rounded-lg p-4 flex flex-col justify-between overflow-hidden min-h-[120px]",
        className
      )}
    >
      {/* Icon Row */}
      <View className="flex-row items-center justify-between">
        <View className="w-9 h-9 rounded-md bg-surface-03 border border-line-subtle items-center justify-center">
          {IconComponent && <IconComponent size={18} color={accentColor} />}
        </View>

        {/* Optional Delta Badge */}
        {delta !== undefined && (
          <View
            className={cn(
              "px-2 py-0.5 rounded-full flex-row items-center border",
              delta > 0
                ? "bg-success/10 border-success/20"
                : delta < 0
                ? "bg-destructive/10 border-destructive/20"
                : "bg-surface-04 border-line-subtle"
            )}
          >
            <Text
              tabular
              className={cn(
                "text-label-xs font-extrabold",
                delta > 0
                  ? "text-success"
                  : delta < 0
                  ? "text-destructive"
                  : "text-content-muted"
              )}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : ""} {Math.abs(delta).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Value & Label Section */}
      <View className="mt-3">
        <Text tabular variant="headingL">
          {value}
        </Text>
        <Text variant="labelXs" className="text-content-muted mt-0.5">
          {label}
        </Text>
      </View>
    </View>
  );
}
