import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Target, BarChart3, Calendar, Car, Settings, Info, Calculator } from "lucide-react-native";
import { Text } from "../../src/components/ui/text";

// Pure View Icon components for visual polish without react-native-svg
const ChevronRightIcon = ({ color = "#64748b" }) => (
  <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }] }} />
);

interface MenuItemProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}

const MenuItem = ({ title, subtitle, icon: Icon, onPress }: MenuItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex flex-row items-center justify-between p-4 bg-slate-900/60 border border-slate-800/60 rounded-xl mb-3 active:bg-slate-800/60"
  >
    <View className="flex flex-row items-center gap-3.5">
      <View className="w-10 h-10 rounded-xl bg-[#1c1b18] border border-[#3d3a35] items-center justify-center">
        <Icon size={20} color="#10b981" />
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
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64 }} contentContainerClassName="p-4 flex flex-col pb-12">
        <View className="my-4">
          <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">More options</Text>
          <Text className="text-xs text-slate-400 mt-1">Configure your workspace and preferences</Text>
        </View>

        <View className="mt-2">
          <MenuItem
            title="Goals"
            subtitle="Manage earnings, mileage, and hour goals"
            icon={Target}
            onPress={() => router.push("/goals")}
          />
          <MenuItem
            title="Tax"
            subtitle="Track quarterly and annual tax withholdings"
            icon={Calculator}
            onPress={() => router.push("/tax")}
          />
          <MenuItem
            title="Reports"
            subtitle="Export spreadsheets and summaries"
            icon={BarChart3}
            onPress={() => router.push("/reports")}
          />
          <MenuItem
            title="Schedule"
            subtitle="Adjust weekly shifts presets"
            icon={Calendar}
            onPress={() => router.push("/schedule")}
          />
          <MenuItem
            title="Vehicles"
            subtitle="Add, edit, or delete active vehicles"
            icon={Car}
            onPress={() => router.push("/vehicles")}
          />
          <MenuItem
            title="Settings"
            subtitle="Configure profile and backup preferences"
            icon={Settings}
            onPress={() => router.push("/settings")}
          />
          <MenuItem
            title="About"
            subtitle="System status, license, and version info"
            icon={Info}
            onPress={() => router.push("/about")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
