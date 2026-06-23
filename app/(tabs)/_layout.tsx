import React from "react";
import { Tabs } from "expo-router";
import { View, Platform, ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "../../store/useSettingsStore";
import GlobalTopHeader from "../../src/components/GlobalTopHeader";

// Custom pure View icon implementations to avoid react-native-svg native dependency crashes
const HomeIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View
      style={{
        width: 0,
        height: 0,
        borderStyle: "solid",
        borderLeftWidth: size / 2,
        borderRightWidth: size / 2,
        borderBottomWidth: size * 0.45,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: color as string,
      }}
    />
    <View
      style={{
        width: size * 0.8,
        height: size * 0.45,
        backgroundColor: color as string,
        marginTop: -1,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <View style={{ width: size * 0.25, height: size * 0.25, backgroundColor: "#12110f", borderTopLeftRadius: 1, borderTopRightRadius: 1 }} />
    </View>
  </View>
);

const ClockPlayIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color as string,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderStyle: "solid",
          borderLeftWidth: size * 0.3,
          borderTopWidth: size * 0.2,
          borderBottomWidth: size * 0.2,
          borderLeftColor: color as string,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          marginLeft: size * 0.08,
        }}
      />
    </View>
  </View>
);

const ChartBarIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingHorizontal: size * 0.1,
      paddingVertical: size * 0.1,
    }}
  >
    <View style={{ width: size * 0.2, height: size * 0.4, backgroundColor: color as string, borderRadius: 1 }} />
    <View style={{ width: size * 0.2, height: size * 0.8, backgroundColor: color as string, borderRadius: 1 }} />
    <View style={{ width: size * 0.2, height: size * 0.6, backgroundColor: color as string, borderRadius: 1 }} />
  </View>
);

const ReceiptIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View
    style={{
      width: size * 0.8,
      height: size,
      borderWidth: 2,
      borderColor: color as string,
      borderRadius: 2,
      padding: size * 0.1,
      justifyContent: "space-around",
      alignItems: "center",
    }}
  >
    <View style={{ width: "80%", height: 1.5, backgroundColor: color as string }} />
    <View style={{ width: "80%", height: 1.5, backgroundColor: color as string }} />
    <View style={{ width: "50%", height: 1.5, backgroundColor: color as string, alignSelf: "flex-start", marginLeft: "10%" }} />
  </View>
);

const CalculatorIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View
    style={{
      width: size * 0.8,
      height: size,
      borderWidth: 2,
      borderColor: color as string,
      borderRadius: 3,
      padding: 2,
      justifyContent: "space-between",
    }}
  >
    <View style={{ width: "100%", height: "25%", backgroundColor: color as string, opacity: 0.3, borderRadius: 1 }} />
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignContent: "space-between", marginTop: 2 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ width: "28%", height: "40%", backgroundColor: color as string, borderRadius: 0.5 }} />
      ))}
    </View>
  </View>
);

const DotsIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => (
  <View style={{ width: size, height: size, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3 }}>
    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color as string }} />
    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color as string }} />
    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color as string }} />
  </View>
);

export default function TabLayout() {
  const { isOnboardingCompleted } = useSettingsStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#070a13" }}>
      {isOnboardingCompleted && <GlobalTopHeader />}
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "bold",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: "#12110f",
          borderTopColor: "#262522",
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          display: isOnboardingCompleted ? "flex" : "none",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: "Shifts",
          tabBarIcon: ({ color }) => <ClockPlayIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <ChartBarIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color }) => <ReceiptIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="tax"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="shifts/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <DotsIcon color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}
