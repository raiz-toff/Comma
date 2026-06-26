import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { Button } from "./button";
import { cn } from "@/src/lib/utils";
import * as LucideIcons from "lucide-react-native";

export interface EmptyStateProps {
  icon: string | React.ComponentType<any>;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const iconMapping: Record<string, keyof typeof LucideIcons> = {
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
  if (lucideKey && LucideIcons[lucideKey]) {
    return LucideIcons[lucideKey] as React.ComponentType<any>;
  }
  
  // Try direct lookup with casing
  const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  if (LucideIcons[capitalized as keyof typeof LucideIcons]) {
    return LucideIcons[capitalized as keyof typeof LucideIcons] as React.ComponentType<any>;
  }

  // Fallback
  return LucideIcons.Info as React.ComponentType<any>;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const IconComponent = typeof icon === "string" ? mapIconName(icon) : icon;

  return (
    <View
      className={cn(
        "flex-1 items-center justify-center py-12 px-6 flex-col",
        className
      )}
    >
      {/* Icon Wrapper */}
      <View className="w-16 h-16 rounded-2xl bg-secondary border border-border items-center justify-center mb-4">
        {IconComponent && <IconComponent size={32} color="#64748b" />}
      </View>

      {/* Copy */}
      <Text className="text-base font-bold text-foreground text-center tracking-tight">
        {title}
      </Text>
      <Text className="text-xs text-muted-foreground text-center mt-1.5 max-w-[280px] leading-relaxed">
        {message}
      </Text>

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-6 border-border bg-card active:bg-secondary px-4 py-2.5 rounded-xl"
          onPress={onAction}
        >
          <Text className="text-xs font-semibold text-foreground">
            {actionLabel}
          </Text>
        </Button>
      )}
    </View>
  );
}
