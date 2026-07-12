import * as React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
} from "react-native";
import { Text } from "@/src/components/ui/text";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getVehicles } from "@/src/database/queries/vehicles";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, PLATFORM_REGISTRY, type PlatformKey } from "@/src/registry/platforms";
import { blendColors } from "../hooks/usePlatformTheme";
import { Bell, Menu, ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";

// ── Platform SVG logos (exact PWA brand assets) ────────────────────────────
export const PLATFORM_LOGO_IDS = new Set(
  Object.values(PLATFORM_REGISTRY)
    .filter((p) => !!p.logo)
    .map((p) => p.id)
);

/** Renders a platform's SVG logo from the registry. Returns null if no logo is registered. */
export const PlatformLogo = ({ id, size = 14 }: { id: string; size?: number }) => {
  const Logo = PLATFORM_REGISTRY[id]?.logo;
  if (!Logo) return null;
  return <Logo size={size} />;
};

// ── Component ──────────────────────────────────────────────────────────────
interface GlobalTopHeaderProps {
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
}

export default function GlobalTopHeader({ onMenuPress, onNotificationsPress }: GlobalTopHeaderProps) {
  const C = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isTaxTab = pathname === "/tax";
  const {
    profile,
    activePlatformFilter,
    setActivePlatformFilter,
    preferredVehicleId,
    setPreferredVehicle,
    isOnboardingCompleted,
    isHeaderVisible,
    dbPlatforms,
  } = useSettingsStore();
  const unreadCount = useSettingsStore((s) => s.notifications.filter((n) => !n.read).length);

  const headerVisibleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(headerVisibleAnim, {
      toValue: isHeaderVisible ? 1 : 0,
      tension: 90,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [isHeaderVisible]);

  const headerTranslateY = headerVisibleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(56 + Math.max(insets.top, 8) + 16), 0],
  });

  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    enabled: isOnboardingCompleted,
  });

  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownAnim = useSharedValue(0);
  const heightAnim = useSharedValue(0);



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
      // Legacy Animated.spring tension 80 / friction 12 → stiffness 375 / damping 37
      // (RN's Origami conversion), same rest thresholds. Runs on the UI thread.
      const spring = {
        stiffness: 375,
        damping: 37,
        mass: 1,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
      };
      dropdownAnim.value = withSpring(1, spring);
      heightAnim.value = withSpring(1, spring);
    } else {
      dropdownAnim.value = withTiming(0, { duration: 180 });
      heightAnim.value = withTiming(0, { duration: 180 }, (finished) => {
        if (finished) {
          runOnJS(setShowDropdown)(false);
        }
      });
    }
  }, [isExpanded]);

  // ── Derived: active platform config ────────────────────────────────────
  const activePlatformConfig = React.useMemo<{ label: string; color: string } | null>(() => {
    if (activePlatformFilter === "all") return null;
    const firstPlatformId = activePlatformFilter.split(",")[0];
    const cfg = PLATFORMS[firstPlatformId as PlatformKey];
    if (cfg) return cfg;
    // Fall back to dbPlatforms for custom/regional platforms
    const dbCfg = dbPlatforms.find((p) => p.id === firstPlatformId);
    if (dbCfg) return { label: dbCfg.label, color: dbCfg.color };
    return null;
  }, [activePlatformFilter, dbPlatforms]);

  const doublePlatforms = React.useMemo(() => {
    if (activePlatformFilter === "all") return [];
    const parts = activePlatformFilter.split(",");
    return parts.length === 2 ? parts : [];
  }, [activePlatformFilter]);

  const isDoubleSelected = doublePlatforms.length === 2;

  const accentColor = React.useMemo(() => {
    if (isDoubleSelected) {
      const c1 = PLATFORMS[doublePlatforms[0] as PlatformKey]?.color ?? C.contentPrimary;
      const c2 = PLATFORMS[doublePlatforms[1] as PlatformKey]?.color ?? C.contentPrimary;
      try {
        return blendColors(c1, c2);
      } catch (e) {
        return c1;
      }
    }
    return activePlatformConfig?.color ?? C.contentPrimary; // white when "all"
  }, [isDoubleSelected, doublePlatforms, activePlatformConfig, C]);

  const borderPillColor = React.useMemo(() => {
    if (isDoubleSelected) {
      const c1 = PLATFORMS[doublePlatforms[0] as PlatformKey]?.color ?? C.contentPrimary;
      const c2 = PLATFORMS[doublePlatforms[1] as PlatformKey]?.color ?? C.contentPrimary;
      try {
        return withAlpha(blendColors(c1, c2), 0.4); // blended border with opacity
      } catch (e) {
        return withAlpha(c1, 0.4);
      }
    }
    return withAlpha(accentColor, 0.25);
  }, [isDoubleSelected, doublePlatforms, accentColor, C]);

  const activeLabel = React.useMemo(() => {
    if (activePlatformFilter === "all") return "All Platforms";
    const parts = activePlatformFilter.split(",");
    const resolveName = (id: string) => {
      const reg = PLATFORMS[id as PlatformKey]?.label;
      if (reg) return reg;
      return dbPlatforms.find((p) => p.id === id)?.label || id;
    };
    if (parts.length > 1) {
      return parts.map(resolveName).join(" + ");
    }
    return activePlatformConfig?.label ?? resolveName(parts[0]);
  }, [activePlatformFilter, activePlatformConfig, dbPlatforms]);

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

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dropdownAnim.value,
  }));

  const dropdownPanelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dropdownAnim.value,
    maxHeight: interpolate(heightAnim.value, [0, 1], [0, 390]),
    marginTop: interpolate(heightAnim.value, [0, 1], [0, 8]),
    paddingTop: interpolate(heightAnim.value, [0, 1], [0, 12]),
    paddingBottom: interpolate(heightAnim.value, [0, 1], [0, 12]),
    borderWidth: interpolate(heightAnim.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(dropdownAnim.value, [0, 1], [-10, 0]) },
      { scale: interpolate(dropdownAnim.value, [0, 1], [0.97, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.container, { paddingTop: Math.max(insets.top, 8), transform: [{ translateY: headerTranslateY }] }]} pointerEvents={isTaxTab ? "box-none" : "auto"}>
      {/* ── Backdrop for closing switcher when clicked outside ── */}
      {showDropdown && (
        <Reanimated.View style={[styles.backdropOverlay, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsExpanded(false)}
          />
        </Reanimated.View>
      )}

      {/* ── Main header row ── */}
      <View style={styles.headerRow} pointerEvents={isTaxTab ? "box-none" : "auto"}>
        {/* Hamburger Menu Button (Pill 1) */}
        <Pressable
          style={styles.hamburgerBtn}
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={8}
        >
          <Menu size={22} color={C.contentSecondary} strokeWidth={2} />
        </Pressable>

        {/* Centre: collapsed platform switcher trigger (Pill 2) — hidden on tax tab */}
        {!isTaxTab && <Pressable
          style={[styles.filterPill, { borderColor: borderPillColor }]}
          onPress={handleToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={`Platform filter: ${activeLabel}`}
          accessibilityState={{ expanded: isExpanded }}
          {...pillPanResponder.panHandlers}
        >
          {isDoubleSelected ? (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              {/* Left Logo */}
              <View style={{ marginRight: 6 }}>
                <PlatformLogo id={doublePlatforms[0]} size={16} />
              </View>

              {/* Name 1 */}
              <Text variant="labelM" numberOfLines={1}>
                {PLATFORMS[doublePlatforms[0] as PlatformKey]?.label ||
                  dbPlatforms.find((p) => p.id === doublePlatforms[0])?.label ||
                  doublePlatforms[0]}
              </Text>

              {/* Centered Plus */}
              <Text variant="labelM" className="text-content-muted" style={{ marginHorizontal: 6 }}>
                +
              </Text>

              {/* Name 2 */}
              <Text variant="labelM" numberOfLines={1}>
                {PLATFORMS[doublePlatforms[1] as PlatformKey]?.label ||
                  dbPlatforms.find((p) => p.id === doublePlatforms[1])?.label ||
                  doublePlatforms[1]}
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
              <Text variant="labelM" style={styles.filterPillLabel} numberOfLines={1}>
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
            ? <ChevronUp size={16} color={C.contentSecondary} strokeWidth={2.5} style={{ marginLeft: 2 }} />
            : <ChevronDown size={16} color={C.contentSecondary} strokeWidth={2.5} style={{ marginLeft: 2 }} />
          }
        </Pressable>}

        {/* Right notification button (Pill 3) — hidden on tax tab */}
        {!isTaxTab && (
          <View style={styles.rightIcons}>
            <Pressable
              style={styles.iconBtn}
              onPress={onNotificationsPress || (() => router.push("/notifications"))}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              hitSlop={8}
            >
              <Bell size={20} color={C.contentPrimary} strokeWidth={2} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text variant="labelXs" style={styles.notifBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Expanded platform + vehicle picker — hidden on tax tab ── */}
      {showDropdown && !isTaxTab && (
        <Reanimated.View
          {...panelPanResponder.panHandlers}
          style={[
            styles.dropdownPanel,
            { overflow: "hidden" },
            dropdownPanelAnimatedStyle,
          ]}
        >
          {/* Section: Platforms */}
          <Text variant="labelXs" className="text-content-secondary" style={styles.panelSectionLabel}>PLATFORM</Text>
          <View style={styles.platformGrid}>
            {allPlatformIds.map((pId) => {
              const isAll = pId === "all";
              const isSelected = isAll
                ? activePlatformFilter === "all"
                : (activePlatformFilter.split(",").includes(pId) ||
                   (selectedPlatformsList.length === 1 && activePlatformFilter === "all"));
              const cfg = !isAll ? PLATFORMS[pId as PlatformKey] : null;
              const dbCfg = !isAll && !cfg ? dbPlatforms.find((p) => p.id === pId) : null;
              const pColor = cfg?.color ?? dbCfg?.color ?? C.contentPrimary;
              const pLabel = cfg?.label ?? dbCfg?.label ?? pId;

              return (
                <Pressable
                  key={pId}
                  onPress={() => handleSelectFilter(pId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.platformGridPill, isSelected
                      ? { borderColor: pColor, backgroundColor: withAlpha(pColor, 0.12) }
                      : styles.dropdownPillInactive]}
                >
                  <View style={[
                    styles.dropdownPillLogo,
                    {
                      backgroundColor: isAll
                        ? (isSelected ? withAlpha(C.contentPrimary, 0.2) : C.surface05)
                        : isSelected ? withAlpha(pColor, 0.2) : C.surface04,
                      borderColor: isSelected ? withAlpha(pColor, 0.25) : "transparent",
                      borderWidth: 1,
                    },
                  ]}>
                    {isAll
                      ? <Text variant="headingS" className="font-extrabold" style={{ color: isSelected ? C.contentPrimary : C.contentSecondary }}>∞</Text>
                      : <PlatformLogo id={pId} size={18} />
                    }
                  </View>
                  <Text variant="labelM" style={{ color: isSelected ? C.contentPrimary : C.contentSecondary, flex: 1 }} numberOfLines={1}>
                    {isAll ? "All" : pLabel}
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
          <Text variant="labelXs" className="text-content-secondary" style={styles.panelSectionLabel}>VEHICLE</Text>
          <View style={styles.platformGrid}>
            {vehiclesList.length === 0 ? (
              <Text variant="paragraphS" style={{ paddingHorizontal: 4 }}>No vehicles set up</Text>
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.platformGridPill, isSelected
                        ? { borderColor: C.contentPrimary, backgroundColor: C.surface04 }
                        : styles.dropdownPillInactive]}
                  >
                    <View style={[
                      styles.dropdownPillLogo,
                      {
                        backgroundColor: isSelected ? withAlpha(C.contentPrimary, 0.2) : C.surface04,
                        borderColor: isSelected ? withAlpha(C.contentPrimary, 0.25) : "transparent",
                        borderWidth: 1,
                      },
                    ]}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                        stroke={isSelected ? C.contentPrimary : C.contentSecondary}
                        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
                        <Rect x="7" y="14" width="10" height="6" rx="1" />
                        <Circle cx="7.5" cy="17.5" r="1.5" />
                        <Circle cx="16.5" cy="17.5" r="1.5" />
                        <Path d="M5 9V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4" />
                      </Svg>
                    </View>
                    <Text variant="labelM" style={{ color: isSelected ? C.contentPrimary : C.contentSecondary, flex: 1 }} numberOfLines={1}>
                      {year}{label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkDot, { backgroundColor: C.contentPrimary }]} />
                    )}
                  </Pressable>
                );
              })
            )}
          </View>

        </Reanimated.View>
      )}
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const makeStyles = (C: Palette) => StyleSheet.create({
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
    backgroundColor: C.scrim,
    zIndex: 90,
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
    backgroundColor: C.surface03,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    justifyContent: "center",
    alignItems: "center",
  },

  // Collapsed filter pill (centre, takes remaining space)
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surface03,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  swatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterPillLabel: {
    flex: 1,
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
    backgroundColor: C.surface03,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: C.destructive,
    borderWidth: 1.5,
    borderColor: C.surface03,
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadgeText: {
    lineHeight: 11,
  },

  dropdownPanel: {
    backgroundColor: C.surface02,
    borderRadius: 16,
    borderColor: C.lineStrong,
    borderWidth: 1,
    marginHorizontal: 16,
    zIndex: 100,
  },
  panelSectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 16,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "48%", // 2 columns layout
    backgroundColor: C.surface03,
    borderColor: C.lineSubtle,
  },
  dropdownPillInactive: {
    borderColor: C.lineSubtle,
    backgroundColor: C.surface03,
  },
  dropdownPillLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  panelDivider: {
    height: 1,
    backgroundColor: C.lineStrong,
    marginHorizontal: 16,
    marginTop: 14,
  },
});
