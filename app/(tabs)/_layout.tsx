import React from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import ReportsScreen from "../reports/index";
import { View, Platform, ColorValue, Animated, Pressable, ScrollView, StyleSheet, BackHandler, useWindowDimensions, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "../../store/useSettingsStore";
import { usePlatformTheme } from "../../src/hooks/usePlatformTheme";
import GlobalTopHeader from "../../src/components/GlobalTopHeader";
import {
  Home,
  Clock,
  BarChart3,
  Receipt,
  Target,
  Calculator,
  FileText,
  Calendar,
  Car,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { Text } from "../../src/components/ui/text";
import { withAlpha } from "../../src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { PLATFORMS, PLATFORM_REGISTRY, type PlatformKey } from "@/src/registry/platforms";
import { getCountryDef } from "@/src/registry/index";
import { useFeatureEnabled } from "../../hooks/useFeatureEnabled";
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { PlatformLogo, PLATFORM_LOGO_IDS } from "@/src/components/GlobalTopHeader";

const DashboardIcon = ({ size = 22, color: colorProp, strokeWidth = 1.5 }: { size?: number; color?: string; strokeWidth?: number }) => {
  const C = useColors();
  const color = colorProp ?? C.contentSecondary;
  const finalStroke = strokeWidth ? strokeWidth * 0.85 : 1.7;
  const adjustedSize = size * 1.35;
  return (
    <Svg width={adjustedSize} height={adjustedSize} viewBox="0 -0.5 25 25" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.918 10.0005H7.082C6.66587 9.99708 6.26541 10.1591 5.96873 10.4509C5.67204 10.7427 5.50343 11.1404 5.5 11.5565V17.4455C5.5077 18.3117 6.21584 19.0078 7.082 19.0005H9.918C10.3341 19.004 10.7346 18.842 11.0313 18.5502C11.328 18.2584 11.4966 17.8607 11.5 17.4445V11.5565C11.4966 11.1404 11.328 10.7427 11.0313 10.4509C10.7346 10.1591 10.3341 9.99708 9.918 10.0005Z"
        stroke={color}
        strokeWidth={finalStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.918 4.0006H7.082C6.23326 3.97706 5.52559 4.64492 5.5 5.4936V6.5076C5.52559 7.35629 6.23326 8.02415 7.082 8.0006H9.918C10.7667 8.02415 11.4744 7.35629 11.5 6.5076V5.4936C11.4744 4.64492 10.7667 3.97706 9.918 4.0006Z"
        stroke={color}
        strokeWidth={finalStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.082 13.0007H17.917C18.3333 13.0044 18.734 12.8425 19.0309 12.5507C19.3278 12.2588 19.4966 11.861 19.5 11.4447V5.55666C19.4966 5.14054 19.328 4.74282 19.0313 4.45101C18.7346 4.1592 18.3341 3.9972 17.918 4.00066H15.082C14.6659 3.9972 14.2654 4.1592 13.9687 4.45101C13.672 4.74282 13.5034 5.14054 13.5 5.55666V11.4447C13.5034 11.8608 13.672 12.2585 13.9687 12.5503C14.2654 12.8421 14.6659 13.0041 15.082 13.0007Z"
        stroke={color}
        strokeWidth={finalStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.082 19.0006H17.917C18.7661 19.0247 19.4744 18.3567 19.5 17.5076V16.4936C19.4744 15.6449 18.7667 14.9771 17.918 15.0006H15.082C14.2333 14.9771 13.5256 15.6449 13.5 16.4936V17.5066C13.525 18.3557 14.2329 19.0241 15.082 19.0006Z"
        stroke={color}
        strokeWidth={finalStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const AnalyticsIcon = ({ size = 22, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentSecondary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.6702 6.94942C21.0302 4.77942 19.2202 2.96942 17.0502 2.32942C15.4002 1.84942 14.2602 1.88942 13.4702 2.47942C12.5202 3.18942 12.4102 4.46942 12.4102 5.37942V7.86942C12.4102 10.3294 13.5302 11.5794 15.7302 11.5794H18.6002C19.5002 11.5794 20.7902 11.4694 21.5002 10.5194C22.1102 9.73942 22.1602 8.59942 21.6702 6.94942Z"
      fill={color}
    />
    <Path
      d="M18.9094 13.3611C18.6494 13.0611 18.2694 12.8911 17.8794 12.8911H14.2994C12.5394 12.8911 11.1094 11.4611 11.1094 9.70113V6.12113C11.1094 5.73113 10.9394 5.35113 10.6394 5.09113C10.3494 4.83113 9.94941 4.71113 9.56941 4.76113C7.21941 5.06113 5.05941 6.35113 3.64941 8.29113C2.22941 10.2411 1.70941 12.6211 2.15941 15.0011C2.80941 18.4411 5.55941 21.1911 9.00941 21.8411C9.55941 21.9511 10.1094 22.0011 10.6594 22.0011C12.4694 22.0011 14.2194 21.4411 15.7094 20.3511C17.6494 18.9411 18.9394 16.7811 19.2394 14.4311C19.2894 14.0411 19.1694 13.6511 18.9094 13.3611Z"
      fill={color}
    />
  </Svg>
  );
};

const ExpensesIcon = ({ size = 22, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentSecondary;
  return (
  <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <Path
      d="M731.15 585.97c-100.99 0-182.86 81.87-182.86 182.86s81.87 182.86 182.86 182.86 182.86-81.87 182.86-182.86-81.87-182.86-182.86-182.86z m0 292.57c-60.5 0-109.71-49.22-109.71-109.71s49.22-109.71 109.71-109.71c60.5 0 109.71 49.22 109.71 109.71s-49.21 109.71-109.71 109.71z"
      fill={color}
    />
    <Path
      d="M758.58 692.98h-54.86v87.27l69.4 68.79 38.6-38.97-53.14-52.68zM219.51 474.96h219.43v73.14H219.51z"
      fill={color}
    />
    <Path
      d="M182.61 365.86h585.62v179.48h73.14V145.21c0-39.96-32.5-72.48-72.46-72.48h-27.36c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57h-18.16c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57H375.3c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57H182.4c-39.96 0-72.48 32.52-72.48 72.48v805.14h401.21v-73.14H183.04l-0.43-511.35z m25.81-222.29c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l15.86-2.3c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l16.59-2.3c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l26.68-0.66v147.5H182.54l-0.13-146.84 26.01-2.33z"
      fill={color}
    />
  </Svg>
  );
};

const AboutIcon = ({ size = 18, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentSecondary;
  return (
  <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <Path
      d="M927.4 273.5v-95.4h-87.9V82.8h-201v95.3h-87.9v95.4h-78.5v-95.4h-88V82.8H183.2v95.3H95.3v95.4H16.7v190.6h78.6v95.4h75.3v95.3H246v95.3h87.9v95.4h100.5v95.3h153.9v-95.3h100.4v-95.4h88v-95.3H852.1v-95.3h75.3v-95.4h78.5V273.5z"
      fill={color}
    />
  </Svg>
  );
};

// Custom pure View icon implementations to avoid react-native-svg native dependency crashes
const HomeIcon = ({ color, size = 20 }: { color: ColorValue; size?: number }) => {
  const C = useColors();
  return (
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
      <View style={{ width: size * 0.25, height: size * 0.25, backgroundColor: C.surface02, borderTopLeftRadius: 1, borderTopRightRadius: 1 }} />
    </View>
  </View>
  );
};

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
  const { isOnboardingCompleted, profile, activePlatformFilter, xpLevel, unlockedBadgeIds, xpTotal } = useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const C = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const isTaxEnabled = useFeatureEnabled("tax_workspace");
  const isGoalsEnabled = useFeatureEnabled("goals");
  const isScheduleEnabled = useFeatureEnabled("schedule");
  const isAnalyticsEnabled = useFeatureEnabled("analytics_advanced");

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isReportsOpen, setIsReportsOpen] = React.useState(false);

  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const reportsAnim = React.useRef(new Animated.Value(0)).current;

  const isDrawerOpenRef = React.useRef(isDrawerOpen);

  React.useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only capture horizontal swipes
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        // If drawer is closed: capture left-to-right swipe starting near the left edge
        if (!isDrawerOpenRef.current) {
          // Capture if start X is within the left 50 pixels of the screen
          return gestureState.x0 < 50 && gestureState.dx > 10;
        }

        // If drawer is open: capture right-to-left swipe from anywhere
        return gestureState.dx < -10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!isDrawerOpenRef.current) {
          if (gestureState.dx > 50) {
            setIsDrawerOpen(true);
          }
        } else {
          if (gestureState.dx < -50) {
            setIsDrawerOpen(false);
          }
        }
      },
    })
  ).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isDrawerOpen ? 1 : 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen]);

  React.useEffect(() => {
    Animated.spring(reportsAnim, {
      toValue: isReportsOpen ? 1 : 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [isReportsOpen]);

  React.useEffect(() => {
    const backAction = () => {
      if (isReportsOpen) {
        setIsReportsOpen(false);
        return true;
      }
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [isDrawerOpen, isReportsOpen]);

  const drawerWidth = Math.min(screenWidth * 0.8, 320);

  const mainContentTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, drawerWidth],
  });

  const drawerTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth * 0.3, 0],
  });

  const reportsTranslateX = reportsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, 0],
  });

  const handleNavigate = (path: string) => {
    setIsDrawerOpen(false);
    if (path === "/reports") {
      setTimeout(() => setIsReportsOpen(true), 200);
      return;
    }
    // Let drawer slide back before navigating
    setTimeout(() => {
      if (path === "/" || path === "/shifts" || path === "/analytics" || path === "/expenses" || path === "/more") {
        router.replace(path as any);
      } else {
        router.push(path as any);
      }
    }, 200);
  };

  const isRouteActive = (itemPath: string) => {
    if (itemPath === "/") {
      return pathname === "/" || pathname === "/(tabs)";
    }
    return pathname.startsWith(itemPath);
  };

  const initials = React.useMemo(() => {
    const name = profile?.displayName?.trim() || "";
    if (!name) return "DR";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [profile?.displayName]);

  const DRAWER_ITEMS = React.useMemo(() => {
    const countryDef = getCountryDef(profile?.country || "CA");
    const items = [
      { label: "Dashboard", path: "/", icon: DashboardIcon },
      { label: "Shifts", path: "/shifts", icon: Clock },
      ...(isAnalyticsEnabled ? [{ label: "Analytics", path: "/analytics", icon: AnalyticsIcon }] : []),
      { label: "Expenses", path: "/expenses", icon: ExpensesIcon },
    ];
    if (isGoalsEnabled) {
      items.push({ label: "Goals", path: "/goals", icon: Target });
    }
    if (isTaxEnabled && countryDef.hasSelfAssessmentTax !== false) {
      items.push({ label: "Tax", path: "/tax", icon: Calculator });
    }
    items.push(
      { label: "Reports", path: "/reports", icon: FileText }
    );
    if (isScheduleEnabled) {
      items.push({ label: "Schedule", path: "/schedule", icon: Calendar });
    }
    items.push(
      { label: "Vehicles", path: "/vehicles", icon: Car },
      { label: "Settings", path: "/settings", icon: SettingsIcon }
    );
    return items;
  }, [profile?.country, isTaxEnabled, isGoalsEnabled, isScheduleEnabled]);

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Drawer Panel - Hidden behind/side-by-side with lower z-index */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}
      >
        {/* Profile Info Section */}
        <View style={styles.profileSectionContainer}>
          <Text variant="headingM" style={styles.sidebarName} numberOfLines={1}>
            {profile?.displayName || "Driver"}
          </Text>
          <View style={styles.sidebarPlatformRow}>
            {(profile?.selectedPlatforms ?? [])
              .filter((pid: string) => PLATFORM_LOGO_IDS.has(pid))
              .slice(0, 6)
              .map((pid: string) => {
                const def = PLATFORM_REGISTRY[pid];
                return (
                  <View
                    key={pid}
                    style={[styles.sidebarPlatformPill, { backgroundColor: def?.color ? withAlpha(def.color, 0.12) : C.surface04, borderColor: def?.color ? withAlpha(def.color, 0.25) : C.lineStrong }]}
                  >
                    <PlatformLogo id={pid} size={16} />
                  </View>
                );
              })}
          </View>
        </View>

        {/* Navigation Items */}
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerContent}
          showsVerticalScrollIndicator={false}
        >
          {DRAWER_ITEMS.map((item) => {
            const active = isRouteActive(item.path);
            const Icon = item.icon;
            return (
              <Pressable
                key={item.path}
                onPress={() => handleNavigate(item.path)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.menuItem,
                  active
                    ? { backgroundColor: accentColorDim, borderWidth: StyleSheet.hairlineWidth, borderColor: accentColorMid }
                    : styles.menuItemInactive,
                ]}
              >
                {active && (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "20%",
                      bottom: "20%",
                      width: 3,
                      backgroundColor: accentColor,
                      borderRadius: 2,
                    }}
                  />
                )}
                <View style={styles.menuIconContainer}>
                  <Icon
                    size={20}
                    color={active ? accentColor : C.contentMuted}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                </View>
                <Text
                  variant="headingS"
                  style={[
                    styles.menuText,
                    active ? styles.menuTextActive : styles.menuTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.drawerFooter}>
          <Pressable
            onPress={() => handleNavigate("/about")}
            accessibilityRole="button"
            accessibilityLabel="About Comma"
            accessibilityState={{ selected: isRouteActive("/about") }}
            style={[
              styles.aboutFooterBtn,
              isRouteActive("/about")
                ? { backgroundColor: accentColorDim, borderColor: accentColorMid, borderWidth: StyleSheet.hairlineWidth }
                : { backgroundColor: "transparent" }
            ]}
          >
            <View style={styles.menuIconContainer}>
              <AboutIcon
                size={18}
                color={isRouteActive("/about") ? accentColor : C.contentSecondary}
              />
            </View>
            <Text
              variant="labelM"
              style={
                isRouteActive("/about") ? { color: accentColor } : { color: C.contentSecondary }
              }
            >
              About Comma
            </Text>
          </Pressable>
          <Text variant="labelXs" className="text-content-muted">COMMA APP · LOCAL & PRIVATE</Text>
        </View>
      </Animated.View>

      {/* Reports Drawer - slides in from the right as a full-screen overlay */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 300,
          transform: [{ translateX: reportsTranslateX }],
          pointerEvents: isReportsOpen ? "auto" : "none",
        }}
      >
        <ReportsScreen onClose={() => setIsReportsOpen(false)} />
      </Animated.View>

      {/* Main Content Wrapper - Animates to the right */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.mainContentContainer,
          {
            transform: [{ translateX: mainContentTranslateX }],
          },
        ]}
      >
        {isOnboardingCompleted && (
          <GlobalTopHeader
            onMenuPress={toggleDrawer}
          />
        )}
        
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              display: "none",
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Dashboard",
            }}
          />
          <Tabs.Screen
            name="shifts"
            options={{
              title: "Shifts",
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              title: "Analytics",
            }}
          />
          <Tabs.Screen
            name="expenses"
            options={{
              title: "Expenses",
            }}
          />
          <Tabs.Screen
            name="tax"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: "More",
            }}
          />
        </Tabs>

        {/* Transparent click catcher over the remaining page area when the drawer is open */}
        {isDrawerOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={styles.mainContentOverlay}
            onPress={() => {
              setIsDrawerOpen(false);
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: C.surface02,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.lineSubtle,
    zIndex: 1,
    flexDirection: "column",
  },
  mainContentContainer: {
    flex: 1,
    backgroundColor: C.background,
    zIndex: 2,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: C.lineStrong,
  },
  mainContentOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(C.background, 0.35),
    zIndex: 9999,
  },

  profileSectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  sidebarName: {
    letterSpacing: -0.3,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sidebarPlatformRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sidebarPlatformPill: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  drawerScroll: {
    flex: 1,
  },
  drawerContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 6,
    gap: 12,
    position: "relative",
  },
  menuItemInactive: {
    backgroundColor: "transparent",
  },
  menuIconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  menuText: {
    flex: 1,
  },
  menuTextActive: {
    color: C.contentPrimary,
  },
  menuTextInactive: {
    color: C.contentSecondary,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineSubtle,
    alignItems: "center",
    width: "100%",
  },
  aboutFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    width: "100%",
    marginBottom: 10,
  },
});
