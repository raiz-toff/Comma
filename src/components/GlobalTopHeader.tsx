import * as React from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { Bell, Settings, Calendar, FileText, Download } from "lucide-react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

export default function GlobalTopHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, activePlatformFilter, setActivePlatformFilter } = useSettingsStore();

  const [timeStr, setTimeStr] = React.useState("");

  React.useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      };
      setTimeStr(d.toLocaleDateString(undefined, options));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Compute initials
  const initials = React.useMemo(() => {
    const name = profile?.displayName?.trim() || "";
    if (!name) return "DR";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [profile?.displayName]);

  const handleSettingsPress = () => {
    router.push("/settings");
  };

  const handleNotificationPress = () => {
    router.push("/settings"); // For now, direct to settings
  };

  // Render platform switcher config
  const selectedPlatformsList = profile?.selectedPlatforms || [];

  const renderPlatformLogo = (platformKey: PlatformKey, active: boolean) => {
    switch (platformKey) {
      case "doordash":
        return (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M23.071 8.409a6.09 6.09 0 0 0-5.396-3.228H.584A.589.589 0 0 0 .17 6.184L3.894 9.93a1.752 1.752 0 0 0 1.242.516h12.049a1.554 1.554 0 1 1 .031 3.108H8.91a.589.589 0 0 0-.415 1.003l3.725 3.747a1.75 1.75 0 0 0 1.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413"
              fill="#FF3008"
            />
          </Svg>
        );
      case "ubereats":
        return (
          <Svg width={14} height={14} viewBox="0 0 192 192" fill="none">
            <Path d="M20 41.85v31.73c.77 8.11 8.14 14.41 16.88 14.52 8.91.12 16.58-6.25 17.36-14.52V41.85" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
            <Path d="M54.24 88.11V55.2m13.84 32.91V41.85" stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Circle cx={84.53} cy={71.66} r={16.45} stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Path d="M142.57 82.97c-3 3.17-7.24 5.14-11.95 5.14-9.09 0-16.45-7.37-16.45-16.45s7.37-16.45 16.45-16.45 16.45 7.37 16.45 16.45h-32.9" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
            <Path d="M160.22 88.11V56.96m11.78 0h0c-1.9 0-3.77.45-5.45 1.32-2.73 1.42-6.33 3.97-6.33 7.51" stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Path d="M50.04 105.14H20v45.01h30.04" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
            <Path d="M20 127.65h30.04m47.61 22.5v-33.08" stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Circle cx={78.4} cy={133.61} r={16.54} stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Path d="M118.62 105.14v40.5c0 2.49 2.02 4.51 4.51 4.51h7.38" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
            <Path d="M109.49 118.52h21.02" stroke="#FFFFFF" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
            <Path d="M144.59 142.08c0 4.33 6.14 7.83 13.71 7.83s13.71-3.51 13.71-7.83-6.14-7.83-13.71-7.83-13.71-3.51-13.71-7.83 6.14-7.83 13.71-7.83 13.71 3.51 13.71 7.83" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          </Svg>
        );
      case "instacart":
        return (
          <Svg width={14} height={14} viewBox="0 0 32 32">
            <Path
              d="M20.839 12.823c1.896 1.906 3.443 5.026 2.557 6.87-2.37 4.953-20.052 13.635-21.557 12.135-1.5-1.5 7.188-19.193 12.135-21.568 1.849-.88 4.964.682 6.87 2.563l-.005.021zM30.208 10.74c-.307-1.141-1.094-2.292-2.266-2.427-2.146-.25-5.536 3.547-5.297 4.448.245.922 5.026 2.5 6.802 1.224.922-.661 1.042-2.083.74-3.219zM23.552.208c1.599.432 3.214 1.531 3.406 3.177.344 3.016-4.979 7.76-6.245 7.422-1.26-.339-3.49-7.047-1.688-9.552.927-1.297 2.932-1.474 4.531-1.052v.005z"
              fill="#43B02A"
            />
          </Svg>
        );
      case "skip":
        return (
          <Svg width={14} height={14} viewBox="0 0 20 20">
            <Rect width={20} height={20} rx={4} fill="#ED5A1F" />
            <Path d="M6 6h8v2H9v2h4v2H9v4H6V6z" fill="#FFFFFF" />
          </Svg>
        );
      case "amazon":
        return (
          <Svg width={14} height={14} viewBox="0 0 20 20">
            <Rect width={20} height={20} rx={4} fill="#232F3E" />
            <Path d="M5 14V6h2l2.5 5 2.5-5h2v8h-2V9.5L9 14H8L6 9.5V14H5z" fill="#FF9900" />
          </Svg>
        );
      default:
        return (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={2} y={7} width={20} height={14} rx={2} ry={2} />
            <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </Svg>
        );
    }
  };

  const isWide = width > 768;

  return (
    <View
      style={[
        styles.safeContainer,
        { paddingTop: Math.max(insets.top, 8) }
      ]}
    >
      <View style={styles.headerBody}>
        {/* Left Section: Avatar (Teal green capsule shape) */}
        <Pressable style={styles.avatarWrapper} onPress={handleSettingsPress}>
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>

        {/* Middle Section: Platform Switcher Scrollbar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.switcherScroll}
          contentContainerStyle={styles.switcherScrollContent}
        >
          <View style={styles.switcherCapsule}>
            {/* "All" Option */}
            <Pressable
              onPress={() => setActivePlatformFilter("all")}
              style={[
                styles.pill,
                activePlatformFilter === "all" ? styles.pillActiveAll : styles.pillInactive
              ]}
            >
              <View style={styles.allBadge}>
                <Text style={styles.allBadgeText}>A</Text>
              </View>
              <Text
                style={[
                  styles.pillText,
                  activePlatformFilter === "all" ? styles.textActive : styles.textInactive
                ]}
              >
                All
              </Text>
            </Pressable>

            {/* Active Platform Options */}
            {selectedPlatformsList.map((platformKey) => {
              const config = PLATFORMS[platformKey as PlatformKey];
              if (!config) return null;
              const isActive = activePlatformFilter === platformKey;

              return (
                <Pressable
                  key={platformKey}
                  onPress={() => setActivePlatformFilter(platformKey)}
                  style={[
                    styles.pill,
                    isActive ? [styles.pillActivePlatform, { borderColor: config.color }] : styles.pillInactive
                  ]}
                >
                  <View style={styles.logoContainer}>
                    {renderPlatformLogo(platformKey as PlatformKey, isActive)}
                  </View>
                  <Text
                    style={[
                      styles.pillText,
                      isActive ? styles.textActive : styles.textInactive
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Right Section: Action Buttons */}
        <View style={styles.rightSection}>
          {/* Calendar Button */}
          <Pressable style={styles.circleButton}>
            <Calendar size={16} color="#ffffff" strokeWidth={2} />
          </Pressable>

          {/* Receipt/Expense Button */}
          <Pressable style={styles.circleButton}>
            <FileText size={16} color="#ffffff" strokeWidth={2} />
          </Pressable>

          {/* Download/Import Button */}
          <Pressable style={styles.downloadButton}>
            <Download size={16} color="#ffffff" strokeWidth={2.5} />
          </Pressable>

          {/* Clock Text (Wide view only) */}
          {(isWide || width > 600) && timeStr !== "" && (
            <Text style={styles.clockText}>{timeStr}</Text>
          )}

          {/* Notification Bell (Green Bell + Red Number Badge) */}
          <Pressable style={styles.bellButton} onPress={handleNotificationPress}>
            <Bell size={20} color="#10b981" strokeWidth={2} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>8</Text>
            </View>
          </Pressable>

          {/* Settings cog */}
          <Pressable style={styles.settingsButton} onPress={handleSettingsPress}>
            <Settings size={20} color="#cbd5e1" strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    backgroundColor: "#0d0d0c",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a19",
    zIndex: 50,
  },
  headerBody: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  avatarWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#064e3b",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  switcherScroll: {
    flex: 1,
    marginHorizontal: 12,
  },
  switcherScrollContent: {
    alignItems: "center",
    paddingVertical: 4,
  },
  switcherCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 4,
    height: 36,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 9999,
    justifyContent: "center",
    marginHorizontal: 1,
  },
  pillActiveAll: {
    backgroundColor: "#27272a",
    borderColor: "#10b981",
    borderWidth: 1.5,
  },
  pillActivePlatform: {
    backgroundColor: "#27272a",
    borderWidth: 1.5,
  },
  pillInactive: {
    backgroundColor: "transparent",
  },
  allBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3f3f46",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  allBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  logoContainer: {
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  textActive: {
    color: "#ffffff",
  },
  textInactive: {
    color: "#94a3b8",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  circleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  clockText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "500",
    marginHorizontal: 6,
  },
  bellButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginRight: 2,
  },
  notificationBadge: {
    position: "absolute",
    top: -1,
    right: -1,
    backgroundColor: "#ef4444",
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: "900",
  },
  settingsButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
