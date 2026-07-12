import React, { useEffect, useRef } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Target, BarChart3, Calendar, Car, Settings, Info, Calculator, ChevronRight } from "lucide-react-native";
import { Text } from "../../src/components/ui/text";
import { useColors } from "@/src/theme/useColors";
import { useSettingsStore } from "../../store/useSettingsStore";
import { usePlatformTheme } from "../../src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import { getCountryDef } from "@/src/registry/index";

interface MenuItemProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  accentColor: string;
}

const MenuItem = ({ title, subtitle, icon: Icon, onPress, accentColor }: MenuItemProps) => {
  const C = useColors();
  return (
  <TouchableOpacity
    accessibilityRole="button"
    onPress={onPress}
    style={{ backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, marginBottom: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color={accentColor} />
      </View>
      <View style={{ flexDirection: "column" }}>
        <Text variant="labelL">{title}</Text>
        <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>{subtitle}</Text>
      </View>
    </View>
    <ChevronRight size={16} color={C.contentDisabled} strokeWidth={2} />
  </TouchableOpacity>
  );
};

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { setHeaderVisible, profile } = useSettingsStore();
  const { accentColor } = usePlatformTheme();
  const { gridStyle } = useLayout();
  const countryDef = getCountryDef(profile?.country || "CA");

  const lastScrollY = useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const isNearBottom = currentY + layoutHeight >= contentHeight - 40;

    if (currentY <= 0 || isNearBottom) {
      setHeaderVisible(true);
    } else if (diff > 15 && currentY > 50) {
      setHeaderVisible(false);
    } else if (diff < -15) {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };

  useEffect(() => {
    setHeaderVisible(true);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={["bottom", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[{ paddingTop: insets.top + 64, paddingHorizontal: 16, paddingBottom: 48 }, gridStyle]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={{ marginVertical: 16 }}>
          <Text variant="headingL">More</Text>
          <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 4 }}>Configure your workspace and preferences</Text>
        </View>

        <View style={{ marginTop: 8 }}>
          <MenuItem
            title="Goals"
            subtitle="Manage earnings, mileage, and hour goals"
            icon={Target}
            onPress={() => router.push("/goals")}
            accentColor={accentColor}
          />
          {countryDef.hasSelfAssessmentTax !== false && (
            <MenuItem
              title="Tax"
              subtitle="Track quarterly and annual tax withholdings"
              icon={Calculator}
              onPress={() => router.push("/tax")}
              accentColor={accentColor}
            />
          )}
          <MenuItem
            title="Reports"
            subtitle="Export spreadsheets and summaries"
            icon={BarChart3}
            onPress={() => router.push("/reports")}
            accentColor={accentColor}
          />
          <MenuItem
            title="Schedule"
            subtitle="Adjust weekly shifts presets"
            icon={Calendar}
            onPress={() => router.push("/schedule")}
            accentColor={accentColor}
          />
          <MenuItem
            title="Vehicles"
            subtitle="Add, edit, or delete active vehicles"
            icon={Car}
            onPress={() => router.push("/vehicles")}
            accentColor={accentColor}
          />
          <MenuItem
            title="Settings"
            subtitle="Configure profile and backup preferences"
            icon={Settings}
            onPress={() => router.push("/settings")}
            accentColor={accentColor}
          />
          <MenuItem
            title="About"
            subtitle="System status, license, and version info"
            icon={Info}
            onPress={() => router.push("/about")}
            accentColor={accentColor}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
