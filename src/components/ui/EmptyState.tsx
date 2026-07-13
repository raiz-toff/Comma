import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { Button } from "./button";
import { cn } from "@/src/lib/utils";
import { lucideIconMap } from "./lucideIconMap";
import { useColors } from "@/src/theme/useColors";

export interface EmptyStateProps {
  icon: string | React.ComponentType<any>;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
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
    console.warn(`EmptyState: unknown icon "${name}", falling back to Info`);
  }
  return lucideIconMap.Info as React.ComponentType<any>;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const C = useColors();
  const IconComponent = typeof icon === "string" ? mapIconName(icon) : icon;

  return (
    // Sizes to its content by default. It must NOT be flex-1 here: as an inline block inside a
    // content-height column (a card on the dashboard, a section on a list screen) flex-1 sets
    // flexBasis to 0, collapsing the box to nothing while the icon and action button spill out
    // above and below it. Screens that use this to fill a blank route pass "flex-1" themselves.
    <View
      className={cn(
        "items-center justify-center py-12 px-6 flex-col",
        className
      )}
    >
      {/* Icon Wrapper */}
      <View className="w-16 h-16 rounded-lg bg-surface-03 border border-line-subtle items-center justify-center mb-4">
        {IconComponent && <IconComponent size={32} color={C.contentMuted} />}
      </View>

      {/* Copy */}
      <Text variant="headingS" className="text-content-primary text-center tracking-tight">
        {title}
      </Text>
      <Text variant="paragraphS" className="text-content-muted text-center mt-1.5 max-w-[280px] leading-relaxed">
        {message}
      </Text>

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-6 border-line-subtle bg-card active:bg-surface-03 px-4 py-2.5 rounded-md"
          onPress={onAction}
        >
          <Text variant="labelM" className="text-content-primary">
            {actionLabel}
          </Text>
        </Button>
      )}
    </View>
  );
}
