import React from "react";
import { View, ScrollView, TouchableOpacity, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/components/ui/text";
import { Card } from "../../src/components/ui/card";

// Pure View Icon components for visual polish without react-native-svg
const ChevronRightIcon = ({ color = "#64748b" }) => (
  <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }] }} />
);

interface MenuItemProps {
  title: string;
  subtitle: string;
  iconChar: string;
  onPress: () => void;
}

const MenuItem = ({ title, subtitle, iconChar, onPress }: MenuItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex flex-row items-center justify-between p-4 bg-slate-900/60 border border-slate-800/60 rounded-xl mb-3 active:bg-slate-800/60"
  >
    <View className="flex flex-row items-center gap-3.5">
      <View className="w-10 h-10 rounded-xl bg-[#1c1b18] border border-[#3d3a35] items-center justify-center">
        <Text className="text-lg">{iconChar}</Text>
      </View>
      <View className="flex flex-col">
        <Text className="text-sm font-bold text-slate-100">{title}</Text>
        <Text className="text-xs text-slate-400 mt-0.5">{subtitle}</Text>
      </View>
    </View>
    <ChevronRightIcon />
  </TouchableOpacity>
);

export default function MoreScreen() {
  const handleNavigation = (dest: string) => {
    Alert.alert("Navigation", `${dest} screen is pending implementation.`);
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      <ScrollView contentContainerClassName="p-4 flex flex-col pb-12">
        <View className="my-4">
          <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">More options</Text>
          <Text className="text-xs text-slate-400 mt-1">Configure your workspace and preferences</Text>
        </View>

        <View className="mt-2">
          <MenuItem
            title="Goals"
            subtitle="Manage earnings, mileage, and hour goals"
            iconChar="🎯"
            onPress={() => handleNavigation("Goals")}
          />
          <MenuItem
            title="Reports"
            subtitle="Export spreadsheets and summaries"
            iconChar="📊"
            onPress={() => handleNavigation("Reports")}
          />
          <MenuItem
            title="Schedule"
            subtitle="Adjust weekly shifts presets"
            iconChar="📅"
            onPress={() => handleNavigation("Schedule")}
          />
          <MenuItem
            title="Vehicles"
            subtitle="Add, edit, or delete active vehicles"
            iconChar="🚗"
            onPress={() => handleNavigation("Vehicles")}
          />
          <MenuItem
            title="Settings"
            subtitle="Configure profile and backup preferences"
            iconChar="⚙️"
            onPress={() => handleNavigation("Settings")}
          />
          <MenuItem
            title="About"
            subtitle="System status, license, and version info"
            iconChar="ℹ️"
            onPress={() => handleNavigation("About")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
