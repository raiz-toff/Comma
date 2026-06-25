import * as React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  UIManager,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getVehicles } from "@/src/database/queries/vehicles";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { blendColors } from "../hooks/usePlatformTheme";
import { Bell, Menu, ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Platform SVG logos (exact PWA brand assets) ────────────────────────────
export const PlatformLogo = ({ id, size = 14 }: { id: string; size?: number }) => {
  switch (id) {
    case "doordash":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M23.071 8.409a6.09 6.09 0 0 0-5.396-3.228H.584A.589.589 0 0 0 .17 6.184L3.894 9.93a1.752 1.752 0 0 0 1.242.516h12.049a1.554 1.554 0 1 1 .031 3.108H8.91a.589.589 0 0 0-.415 1.003l3.725 3.747a1.75 1.75 0 0 0 1.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413"
            fill="#FF3008"
          />
        </Svg>
      );
    case "ubereats":
      return (
        <Svg width={size} height={size} viewBox="0 0 192 192" fill="none">
          <Path d="M20 41.85v31.73c.77 8.11 8.14 14.41 16.88 14.52 8.91.12 16.58-6.25 17.36-14.52V41.85" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          <Path d="M54.24 88.11V55.2m13.84 32.91V41.85" stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
          <Circle cx={84.53} cy={71.66} r={16.45} stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
          <Path d="M142.57 82.97c-3 3.17-7.24 5.14-11.95 5.14-9.09 0-16.45-7.37-16.45-16.45s7.37-16.45 16.45-16.45 16.45 7.37 16.45 16.45h-32.9" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          <Path d="M160.22 88.11V56.96m11.78 0h0c-1.9 0-3.77.45-5.45 1.32-2.73 1.42-6.33 3.97-6.33 7.51" stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
        </Svg>
      );
    case "instacart":
      return (
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Path
            d="M20.839 12.823c1.896 1.906 3.443 5.026 2.557 6.87-2.37 4.953-20.052 13.635-21.557 12.135-1.5-1.5 7.188-19.193 12.135-21.568 1.849-.88 4.964.682 6.87 2.563l-.005.021zM30.208 10.74c-.307-1.141-1.094-2.292-2.266-2.427-2.146-.25-5.536 3.547-5.297 4.448.245.922 5.026 2.5 6.802 1.224.922-.661 1.042-2.083.74-3.219zM23.552.208c1.599.432 3.214 1.531 3.406 3.177.344 3.016-4.979 7.76-6.245 7.422-1.26-.339-3.49-7.047-1.688-9.552.927-1.297 2.932-1.474 4.531-1.052v.005z"
            fill="#0AAD0A"
          />
        </Svg>
      );
    case "skip":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#ED5A1F" />
          <Path d="M6 6h8v2H9v2h4v2H9v4H6V6z" fill="#FFFFFF" />
        </Svg>
      );
    case "amazonflex":
    case "amazon":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#232F3E" />
          <Path d="M5 14V6h2l2.5 5 2.5-5h2v8h-2V9.5L9 14H8L6 9.5V14H5z" fill="#FF9900" />
        </Svg>
      );
    case "foodora":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#D8003F" />
          <Path d="M7 5h6v2H9v2h3v2H9v4H7V5z" fill="#FFFFFF" />
        </Svg>
      );
    case "lyft":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#FF00BF" />
          <Path d="M7 5v8c0 1.1.9 2 2 2h4v-2H9V5H7z" fill="#FFFFFF" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={2} y={7} width={20} height={14} rx={2} ry={2} />
          <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </Svg>
      );
  }
};

// ── Component ──────────────────────────────────────────────────────────────
interface GlobalTopHeaderProps {
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
}

export default function GlobalTopHeader({ onMenuPress, onNotificationsPress }: GlobalTopHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    activePlatformFilter,
    setActivePlatformFilter,
    preferredVehicleId,
    setPreferredVehicle,
    isOnboardingCompleted,
  } = useSettingsStore();

  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    enabled: isOnboardingCompleted,
  });

  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownAnim = React.useRef(new Animated.Value(0)).current;
  const heightAnim = React.useRef(new Animated.Value(0)).current;



  // ── Swipe-to-Open Gesture Responder ──
  const pillPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Intercept only when dragging downward vertically
        return gestureState.dy > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 20) {
          setIsExpanded(true);
        }
      },
    })
  ).current;

  // ── Swipe-to-Close Gesture Responder ──
  const panelPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Intercept only when dragging upward vertically
        return gestureState.dy < -10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -25) {
          // Swipe up: Close switcher
          setIsExpanded(false);
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (isExpanded) {
      setShowDropdown(true);
      Animated.parallel([
        Animated.spring(dropdownAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: false,
        }),
        Animated.spring(heightAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dropdownAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start(() => {
        setShowDropdown(false);
      });
    }
  }, [isExpanded]);

  // ── Derived: active platform config ────────────────────────────────────
  const activePlatformConfig = React.useMemo<{ label: string; color: string } | null>(() => {
    if (activePlatformFilter === "all") return null;
    const firstPlatformId = activePlatformFilter.split(",")[0];
    const cfg = PLATFORMS[firstPlatformId as PlatformKey];
    return cfg ?? null;
  }, [activePlatformFilter]);

  const doublePlatforms = React.useMemo(() => {
    if (activePlatformFilter === "all") return [];
    const parts = activePlatformFilter.split(",");
    return parts.length === 2 ? parts : [];
  }, [activePlatformFilter]);

  const isDoubleSelected = doublePlatforms.length === 2;

  const accentColor = React.useMemo(() => {
    if (isDoubleSelected) {
      const c1 = PLATFORMS[doublePlatforms[0] as PlatformKey]?.color ?? "#ffffff";
      const c2 = PLATFORMS[doublePlatforms[1] as PlatformKey]?.color ?? "#ffffff";
      try {
        return blendColors(c1, c2);
      } catch (e) {
        return c1;
      }
    }
    return activePlatformConfig?.color ?? "#ffffff"; // white when "all"
  }, [isDoubleSelected, doublePlatforms, activePlatformConfig]);

  const borderPillColor = React.useMemo(() => {
    if (isDoubleSelected) {
      const c1 = PLATFORMS[doublePlatforms[0] as PlatformKey]?.color ?? "#ffffff";
      const c2 = PLATFORMS[doublePlatforms[1] as PlatformKey]?.color ?? "#ffffff";
      try {
        return blendColors(c1, c2) + "66"; // blended border with opacity
      } catch (e) {
        return c1 + "66";
      }
    }
    return accentColor + "44";
  }, [isDoubleSelected, doublePlatforms, accentColor]);

  const activeLabel = React.useMemo(() => {
    if (activePlatformFilter === "all") return "All Platforms";
    const parts = activePlatformFilter.split(",");
    if (parts.length > 1) {
      return parts.map(p => PLATFORMS[p as PlatformKey]?.label || p).join(" + ");
    }
    return activePlatformConfig?.label ?? activePlatformFilter;
  }, [activePlatformFilter, activePlatformConfig]);

  const selectedPlatformsList: string[] = profile?.selectedPlatforms ?? [];
  const allPlatformIds = selectedPlatformsList.length <= 1
    ? selectedPlatformsList
    : ["all", ...selectedPlatformsList];

  const maxAllowed = React.useMemo(() => {
    return Math.max(1, selectedPlatformsList.length - 1);
  }, [selectedPlatformsList]);



  // ── Toggle ──────────────────────────────────────────────────────────────
  const handleToggleExpand = () => {
    setIsExpanded((v) => !v);
  };

  const handleSelectFilter = (id: string) => {
    if (id === "all") {
      setActivePlatformFilter("all");
      setIsExpanded(false);
      return;
    }

    const currentFilter = activePlatformFilter;
    if (currentFilter === "all") {
      setActivePlatformFilter(id);
      if (maxAllowed === 1) {
        setTimeout(() => {
          setIsExpanded(false);
        }, 500);
      }
    } else {
      const parts = currentFilter.split(",");
      if (parts.includes(id)) {
        // Deselect
        const updated = parts.filter((p) => p !== id);
        if (updated.length === 0) {
          setActivePlatformFilter("all");
          setIsExpanded(false);
        } else {
          setActivePlatformFilter(updated.join(","));
        }
      } else {
        // Select
        const updated = [...parts, id];
        if (updated.length > maxAllowed) {
          // Cap at maxAllowed, remove the oldest selection
          updated.shift();
        }
        setActivePlatformFilter(updated.join(","));
        // If maxAllowed are selected, close switcher smoothly after a short delay
        if (updated.length === maxAllowed) {
          setTimeout(() => {
            setIsExpanded(false);
          }, 500);
        }
      }
    }
  };

  const maxHeightVal = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 390],
  });

  const marginTopVal = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const paddingVal = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  const borderVal = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* ── Backdrop for closing switcher when clicked outside ── */}
      {showDropdown && (
        <Animated.View
          style={[
            styles.backdropOverlay,
            {
              opacity: dropdownAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsExpanded(false)}
          />
        </Animated.View>
      )}

      {/* ── Main header row ── */}
      <View style={styles.headerRow}>
        {/* Hamburger Menu Button (Pill 1) */}
        <Pressable
          style={styles.hamburgerBtn}
          onPress={onMenuPress}
        >
          <Menu size={22} color="#94a3b8" strokeWidth={2} />
        </Pressable>

        {/* Centre: collapsed platform switcher trigger (Pill 2) */}
        <Pressable
          style={[styles.filterPill, { borderColor: borderPillColor }]}
          onPress={handleToggleExpand}
          {...pillPanResponder.panHandlers}
        >
          {isDoubleSelected ? (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              {/* Left Logo */}
              <View style={{ marginRight: 6 }}>
                <PlatformLogo id={doublePlatforms[0]} size={16} />
              </View>

              {/* Name 1 */}
              <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {PLATFORMS[doublePlatforms[0] as PlatformKey]?.label || doublePlatforms[0]}
              </Text>

              {/* Centered Plus */}
              <Text style={{ color: "#64748b", fontSize: 14, fontWeight: "600", marginHorizontal: 6 }}>
                +
              </Text>

              {/* Name 2 */}
              <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {PLATFORMS[doublePlatforms[1] as PlatformKey]?.label || doublePlatforms[1]}
              </Text>

              {/* Right Logo */}
              <View style={{ marginLeft: 6, marginRight: 2 }}>
                <PlatformLogo id={doublePlatforms[1]} size={16} />
              </View>
            </View>
          ) : (
            <>
              {/* Color swatch dot */}
              <View style={[styles.swatchDot, { backgroundColor: accentColor }]} />

              {/* Active label */}
              <Text style={styles.filterPillLabel} numberOfLines={1}>
                {activeLabel}
              </Text>

              {/* Platform logo (only when not "all") */}
              {activePlatformFilter !== "all" && (
                <View style={styles.pillLogoWrap}>
                  <PlatformLogo id={activePlatformFilter.split(",")[0]} size={16} />
                </View>
              )}
            </>
          )}

          {/* Chevron */}
          {isExpanded
            ? <ChevronUp size={16} color="#94a3b8" strokeWidth={2.5} style={{ marginLeft: 2 }} />
            : <ChevronDown size={16} color="#94a3b8" strokeWidth={2.5} style={{ marginLeft: 2 }} />
          }
        </Pressable>

        {/* Right notification button (Pill 3) */}
        <View style={styles.rightIcons}>
          <Pressable style={styles.iconBtn} onPress={onNotificationsPress || (() => router.push("/notifications"))}>
            <Bell size={20} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* ── Expanded platform + vehicle picker ── */}
      {showDropdown && (
        <Animated.View
          {...panelPanResponder.panHandlers}
          style={[
            styles.dropdownPanel,
            {
              opacity: dropdownAnim,
              maxHeight: maxHeightVal,
              marginTop: marginTopVal,
              paddingTop: paddingVal,
              paddingBottom: paddingVal,
              borderWidth: borderVal,
              overflow: "hidden",
              transform: [
                {
                  translateY: dropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
                {
                  scale: dropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Section: Platforms */}
          <Text style={styles.panelSectionLabel}>PLATFORM</Text>
          <View style={styles.platformGrid}>
            {allPlatformIds.map((pId) => {
              const isAll = pId === "all";
              const isSelected = isAll
                ? activePlatformFilter === "all"
                : (activePlatformFilter.split(",").includes(pId) ||
                   (selectedPlatformsList.length === 1 && activePlatformFilter === "all"));
              const cfg = !isAll ? PLATFORMS[pId as PlatformKey] : null;
              const pColor = cfg?.color ?? "#ffffff";

              return (
                <Pressable
                  key={pId}
                  onPress={() => handleSelectFilter(pId)}
                  style={[
                    styles.platformGridPill,
                    isSelected
                      ? { borderColor: pColor, backgroundColor: pColor + "18" }
                      : styles.dropdownPillInactive,
                  ]}
                >
                  <View style={[
                    styles.dropdownPillLogo,
                    {
                      backgroundColor: isAll
                        ? (isSelected ? "#ffffff33" : "#2a2a28")
                        : isSelected ? pColor + "33" : "#1e1e1c",
                      borderColor: isSelected ? pColor + "44" : "transparent",
                      borderWidth: 1,
                    },
                  ]}>
                    {isAll
                      ? <Text style={[styles.dropdownPillLogoText, { color: isSelected ? "#ffffff" : "#94a3b8" }]}>∞</Text>
                      : <PlatformLogo id={pId} size={18} />
                    }
                  </View>
                  <Text style={[
                    styles.dropdownPillLabel,
                    { color: isSelected ? "#ffffff" : "#a1a1aa", flex: 1 },
                  ]} numberOfLines={1}>
                    {isAll ? "All" : cfg?.label || pId}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkDot, { backgroundColor: pColor }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Divider */}
          <View style={styles.panelDivider} />

          {/* Section: Vehicle */}
          <Text style={styles.panelSectionLabel}>VEHICLE</Text>
          <View style={styles.platformGrid}>
            {vehiclesList.length === 0 ? (
              <Text style={{ color: "#52525b", fontSize: 12, paddingHorizontal: 4 }}>No vehicles set up</Text>
            ) : (
              vehiclesList.map((v: any) => {
                const isSelected = (preferredVehicleId || vehiclesList[0]?.id) === v.id;
                const label = `${v.make || ""} ${v.model || ""}`.trim() || v.name;
                const year = v.year ? `'${String(v.year).slice(-2)} ` : "";
                return (
                  <Pressable
                    key={v.id}
                    onPress={async () => {
                      await setPreferredVehicle(v.id);
                      setIsExpanded(false);
                    }}
                    style={[
                      styles.platformGridPill,
                      isSelected
                        ? { borderColor: "#ffffff", backgroundColor: "#ffffff18" }
                        : styles.dropdownPillInactive,
                    ]}
                  >
                    <View style={[
                      styles.dropdownPillLogo,
                      {
                        backgroundColor: isSelected ? "#ffffff33" : "#1e1e1c",
                        borderColor: isSelected ? "#ffffff44" : "transparent",
                        borderWidth: 1,
                      },
                    ]}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                        stroke={isSelected ? "#ffffff" : "#a1a1aa"}
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
                        <Rect x="7" y="14" width="10" height="6" rx="1" />
                        <Circle cx="7.5" cy="17.5" r="1.5" />
                        <Circle cx="16.5" cy="17.5" r="1.5" />
                        <Path d="M5 9V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4" />
                      </Svg>
                    </View>
                    <Text style={[
                      styles.dropdownPillLabel,
                      { color: isSelected ? "#ffffff" : "#a1a1aa", flex: 1 },
                    ]} numberOfLines={1}>
                      {year}{label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkDot, { backgroundColor: "#ffffff" }]} />
                    )}
                  </Pressable>
                );
              })
            )}
          </View>

        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
    zIndex: 1000,
  },
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: -100,
    right: -100,
    height: 3000,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    zIndex: 90,
  },

  // 2-px accent strip at very top
  accentStrip: {
    height: 0,
    width: 0,
  },

  // Header row
  headerRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
    zIndex: 110,
  },

  // Hamburger button
  hamburgerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 1,
    borderColor: "#262522",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  // Avatar
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#064e3b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  // Collapsed filter pill (centre, takes remaining space)
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#161615",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  swatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterPillLabel: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
  pillLogoWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Right icons
  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 1,
    borderColor: "#262522",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },

  dropdownPanel: {
    backgroundColor: "#111110",
    borderRadius: 16,
    borderColor: "#2a2a28",
    borderWidth: 1,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  panelSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 16,
    textTransform: "uppercase",
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  platformGridPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "48%", // 2 columns layout
    backgroundColor: "#161615",
    borderColor: "#262624",
  },
  dropdownPillInactive: {
    borderColor: "#262624",
    backgroundColor: "#161615",
  },
  dropdownPillLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownPillLogoText: {
    fontSize: 16,
    fontWeight: "900",
  },
  dropdownPillLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  panelDivider: {
    height: 1,
    backgroundColor: "#2a2a28",
    marginHorizontal: 16,
    marginTop: 14,
  },

  filterInfoBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  filterInfoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterInfoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
  },
  clearFilterText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },

});
