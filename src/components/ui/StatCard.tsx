import * as React from "react";
import { View } from "react-native";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";
import * as LucideIcons from "lucide-react-native";

export interface StatCardProps {
  icon: string | React.ComponentType<any>;
  label: string;
  value: string | number;
  delta?: number; // % vs last period
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

export function StatCard({
  icon,
  label,
  value,
  delta,
  className,
}: StatCardProps) {
  // Resolve icon component
  const IconComponent = typeof icon === "string" ? mapIconName(icon) : icon;

  return (
    <View
      className={cn(
        "border border-slate-800 bg-[#1a1916] rounded-2xl p-4 flex flex-col justify-between overflow-hidden min-h-[120px]",
        className
      )}
    >
      {/* Icon Row */}
      <View className="flex-row items-center justify-between">
        <View className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 items-center justify-center">
          {IconComponent && <IconComponent size={18} color="#10b981" />}
        </View>
        
        {/* Optional Delta Badge */}
        {delta !== undefined && (
          <View
            className={cn(
              "px-2 py-0.5 rounded-full flex-row items-center border",
              delta > 0
                ? "bg-emerald-500/10 border-emerald-500/20"
                : delta < 0
                ? "bg-rose-500/10 border-rose-500/20"
                : "bg-slate-500/10 border-slate-500/20"
            )}
          >
            <Text
              className={cn(
                "text-[10px] font-extrabold tracking-wider",
                delta > 0
                  ? "text-emerald-500"
                  : delta < 0
                  ? "text-rose-500"
                  : "text-slate-500"
              )}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : ""} {Math.abs(delta).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Value & Label Section */}
      <View className="mt-3">
        <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">
          {value}
        </Text>
        <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
          {label}
        </Text>
      </View>
    </View>
  );
}
