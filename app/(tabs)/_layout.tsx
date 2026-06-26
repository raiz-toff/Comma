import React from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import { View, Platform, ColorValue, Animated, Pressable, ScrollView, StyleSheet, BackHandler, useWindowDimensions, TouchableOpacity, PanResponder } from "react-native";
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
  Info,
  Trophy,
  AlertCircle,
  BellOff,
  Check,
  Bell,
} from "lucide-react-native";
import { Text } from "../../src/components/ui/text";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";

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

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning";
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    title: "Weekly Earnings Goal Achieved!",
    description: "Congratulations! You reached 100% of your weekly earnings target across all active platforms.",
    time: "2 hours ago",
    type: "success",
    read: false,
  },
  {
    id: "2",
    title: "Tax season reminder",
    description: "Your estimated quarterly tax withholding report is ready. View it in the Tax page.",
    time: "1 day ago",
    type: "warning",
    read: false,
  },
  {
    id: "3",
    title: "Shift Logged Successfully",
    description: "Your 6h 15m Uber Eats shift has been added to your dashboard history.",
    time: "2 days ago",
    type: "info",
    read: true,
  },
  {
    id: "4",
    title: "Welcome to COMMA!",
    description: "Your local database has been initialized. You are ready to start tracking your gig mileage and earnings with absolute privacy.",
    time: "3 days ago",
    type: "info",
    read: true,
  },
];

export default function TabLayout() {
  const { isOnboardingCompleted, profile, activePlatformFilter } = useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const notificationsAnim = React.useRef(new Animated.Value(0)).current;

  const isDrawerOpenRef = React.useRef(isDrawerOpen);
  const isNotificationsOpenRef = React.useRef(isNotificationsOpen);

  React.useEffect(() => {
    isDrawerOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen]);

  React.useEffect(() => {
    isNotificationsOpenRef.current = isNotificationsOpen;
  }, [isNotificationsOpen]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only capture horizontal swipes
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        if (!isHorizontal) return false;

        // If drawer is closed: capture left-to-right swipe starting near the left edge
        if (!isDrawerOpenRef.current) {
          if (isNotificationsOpenRef.current) return false;
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

  const [notifications, setNotifications] = React.useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string, read: boolean) => {
    const color = read ? "#64748b" : "#10b981";
    switch (type) {
      case "success":
        return <Trophy size={18} color={read ? "#64748b" : "#eab308"} />;
      case "warning":
        return <AlertCircle size={18} color={read ? "#64748b" : "#f59e0b"} />;
      default:
        return <Info size={18} color={color} />;
    }
  };

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isDrawerOpen ? 1 : 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen]);

  React.useEffect(() => {
    Animated.spring(notificationsAnim, {
      toValue: isNotificationsOpen ? 1 : 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isNotificationsOpen]);

  React.useEffect(() => {
    const backAction = () => {
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
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
  }, [isDrawerOpen, isNotificationsOpen]);

  const drawerWidth = Math.min(screenWidth * 0.8, 320);
  const notificationsWidth = Math.min(screenWidth, 400);

  const mainContentTranslateX = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, drawerWidth],
    }),
    notificationsAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -notificationsWidth],
    })
  );

  const drawerTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth * 0.3, 0],
  });

  const notificationsTranslateX = notificationsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, screenWidth - notificationsWidth],
  });

  const handleNavigate = (path: string) => {
    setIsDrawerOpen(false);
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

  const activePlatformLabel = React.useMemo(() => {
    if (activePlatformFilter === "all") return "All Platforms";
    const cfg = PLATFORMS[activePlatformFilter as PlatformKey];
    return cfg?.label ?? "Platform Filtered";
  }, [activePlatformFilter]);

  const activePlatformColor = React.useMemo(() => {
    if (activePlatformFilter === "all") return "#ffffff";
    const cfg = PLATFORMS[activePlatformFilter as PlatformKey];
    return cfg?.color ?? "#ffffff";
  }, [activePlatformFilter]);

  const DRAWER_ITEMS = [
    { label: "Dashboard", path: "/", icon: Home },
    { label: "Shifts", path: "/shifts", icon: Clock },
    { label: "Analytics", path: "/analytics", icon: BarChart3 },
    { label: "Expenses", path: "/expenses", icon: Receipt },
    { label: "Goals", path: "/goals", icon: Target },
    { label: "Tax", path: "/tax", icon: Calculator },
    { label: "Reports", path: "/reports", icon: FileText },
    { label: "Schedule", path: "/schedule", icon: Calendar },
    { label: "Vehicles", path: "/vehicles", icon: Car },
    { label: "Settings", path: "/settings", icon: SettingsIcon },
  ];

  const toggleDrawer = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
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
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { borderColor: accentColorMid, backgroundColor: accentColorDim }]}>
            <Text style={[styles.avatarText, { color: accentColor }]}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{profile?.displayName || "Driver"}</Text>
            <Text style={styles.profileSub} numberOfLines={1}>
              {profile?.country || "US"} Standard • {activePlatformLabel}
            </Text>
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
                style={[
                  styles.menuItem,
                  active ? [styles.menuItemActive, { backgroundColor: accentColorDim, borderColor: accentColorMid, borderWidth: 0.8 }] : styles.menuItemInactive,
                ]}
              >
                <Icon
                  size={22}
                  color={active ? accentColor : "#a1a1aa"}
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text
                  style={[
                    styles.menuText,
                    active ? [styles.menuTextActive, { color: accentColor }] : styles.menuTextInactive,
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
            style={[
              styles.aboutFooterBtn,
              isRouteActive("/about")
                ? { backgroundColor: accentColorDim, borderColor: accentColorMid, borderWidth: 0.8 }
                : { backgroundColor: "transparent" }
            ]}
          >
            <Info
              size={18}
              color={isRouteActive("/about") ? accentColor : "#a1a1aa"}
              strokeWidth={isRouteActive("/about") ? 2.5 : 2}
            />
            <Text
              style={[
                styles.aboutFooterText,
                isRouteActive("/about") ? { color: accentColor } : { color: "#a1a1aa" }
              ]}
            >
              About Comma
            </Text>
          </Pressable>
          <Text style={styles.footerText}>COMMA APP · LOCAL & PRIVATE</Text>
        </View>
      </Animated.View>

      {/* Notifications Panel - Hidden on the right with z-index 1 */}
      <Animated.View
        style={[
          styles.notificationsDrawer,
          {
            width: notificationsWidth,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateX: notificationsTranslateX }],
          },
        ]}
      >
        {/* Notifications Header */}
        <View style={styles.drawerHeader}>
          <TouchableOpacity
            onPress={() => setIsNotificationsOpen(false)}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.notificationsTitle}>Notifications</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Notifications List */}
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.notificationsContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length > 0 ? (
            <>
              <View style={styles.notifActionsRow}>
                <Text style={styles.notifCountText}>
                  Recent Alerts ({notifications.filter((n) => !n.read).length} unread)
                </Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={[styles.actionTextGreen, { color: accentColor }]}>Mark all read</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={styles.actionTextGray}>Clear all</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: "column", gap: 12 }}>
                {notifications.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.notifCard,
                      item.read ? styles.notifCardRead : styles.notifCardUnread,
                    ]}
                  >
                    <View style={{ marginTop: 2 }}>
                      {getNotificationIcon(item.type, item.read)}
                    </View>
                    <View style={{ flex: 1, flexDirection: "column" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={[styles.notifCardTitle, item.read ? styles.notifTextRead : styles.notifTextUnread]}>
                          {item.title}
                        </Text>
                        {!item.read && (
                          <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
                        )}
                      </View>
                      <Text style={styles.notifCardDesc}>
                        {item.description}
                      </Text>
                      <Text style={styles.notifCardTime}>
                        {item.time}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <BellOff size={28} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>
                You have no new notifications. We'll alert you here when goals are reached or reports are compiled.
              </Text>
            </View>
          )}
        </ScrollView>
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
            onNotificationsPress={() => setIsNotificationsOpen(true)}
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

        {/* Transparent click catcher over the remaining page area when drawer or notifications are open */}
        {(isDrawerOpen || isNotificationsOpen) && (
          <Pressable
            style={styles.mainContentOverlay}
            onPress={() => {
              setIsDrawerOpen(false);
              setIsNotificationsOpen(false);
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    zIndex: 999,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#000000",
    borderRightWidth: 0.8,
    borderRightColor: "#1f1f1f",
    zIndex: 1,
    flexDirection: "column",
  },
  notificationsDrawer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#000000",
    borderLeftWidth: 0.8,
    borderLeftColor: "#1f1f1f",
    zIndex: 1,
    flexDirection: "column",
  },
  mainContentContainer: {
    flex: 1,
    backgroundColor: "#000000",
    zIndex: 2,
    shadowColor: "#000000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  mainContentOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    zIndex: 9999,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a19",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  drawerBrand: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
  },

  profileSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a19",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  profileSub: {
    fontSize: 11,
    color: "#64748b",
  },
  drawerScroll: {
    flex: 1,
  },
  drawerContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
    gap: 16,
    position: "relative",
  },
  menuItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  menuItemInactive: {
    backgroundColor: "transparent",
  },
  menuText: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  menuTextActive: {
    color: "#ffffff",
  },
  menuTextInactive: {
    color: "#a1a1aa",
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 0.8,
    borderTopColor: "#1f1f1f",
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
  aboutFooterText: {
    fontSize: 14,
    fontWeight: "700",
  },
  footerText: {
    fontSize: 10,
    color: "#52525b",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.3)",
  },
  backBtnText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  notificationsTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  notificationsContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  notifActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  notifCountText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionTextGreen: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "700",
  },
  actionTextGray: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  notifCard: {
    borderWidth: 0.8,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: "#0d0d0d",
    borderColor: "#1f1f1f",
  },
  notifCardRead: {
    backgroundColor: "transparent",
    borderColor: "#161615",
    opacity: 0.5,
  },
  notifCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    paddingRight: 8,
  },
  notifTextUnread: {
    color: "#f8fafc",
  },
  notifTextRead: {
    color: "#94a3b8",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  notifCardDesc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 4,
  },
  notifCardTime: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "700",
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    flexDirection: "column",
    gap: 16,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 18,
  },
});
