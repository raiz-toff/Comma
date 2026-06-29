import * as React from "react";
import { View, Pressable, Share, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Text } from "@/src/components/ui/text";
import { AppBottomSheet, type AppBottomSheetRef } from "@/src/components/ui/AppBottomSheet";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { BADGES } from "@/src/registry/badges";

/**
 * CelebrationSheet — "Bulletin Mode" milestone moment (the thing Uber/DoorDash
 * have and Comma lacked). Presented when evaluateGamification() unlocks a badge.
 *
 * Display-size headline, the badge art, a congratulatory line, accent-colored
 * confetti burst, and two actions: Share + Done. Drive it with a ref:
 *   const ref = useRef<CelebrationSheetRef>(null);
 *   ref.current?.celebrate(badgeId);
 */

export interface CelebrationSheetRef {
  celebrate: (badgeId: string) => void;
  dismiss: () => void;
}

const CONFETTI_COUNT = 14;

function ConfettiPiece({ index, color }: { index: number; color: string }) {
  // Deterministic spread per index (no Math.random — keeps it stable across renders).
  const spread = ((index / (CONFETTI_COUNT - 1)) - 0.5) * 280;
  const drift = (index % 3) - 1;
  const ty = useSharedValue(0);
  const tx = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(700, withTiming(0, { duration: 500 }))
    );
    ty.value = withTiming(140 + (index % 4) * 28, { duration: 1100, easing: Easing.out(Easing.quad) });
    tx.value = withTiming(spread, { duration: 1100, easing: Easing.out(Easing.quad) });
    rot.value = withTiming((drift || 1) * 360, { duration: 1100 });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: ty.value },
      { translateX: tx.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          width: 8,
          height: 8,
          borderRadius: index % 2 === 0 ? 4 : 1,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export const CelebrationSheet = React.forwardRef<CelebrationSheetRef>(
  function CelebrationSheet(_props, ref) {
    const sheetRef = React.useRef<AppBottomSheetRef>(null);
    const [badgeId, setBadgeId] = React.useState<string | null>(null);
    const [burstKey, setBurstKey] = React.useState(0);
    const { accentColor, accentColorContrast } = usePlatformTheme();

    React.useImperativeHandle(ref, () => ({
      celebrate: (id: string) => {
        setBadgeId(id);
        setBurstKey((k) => k + 1);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const badge = badgeId ? BADGES.find((b) => b.id === badgeId) : undefined;

    const handleShare = React.useCallback(() => {
      if (!badge) return;
      Share.share({
        message: `I just unlocked "${badge.name}" on Comma — ${badge.description} 🎉`,
      }).catch(() => {});
    }, [badge]);

    // The semantic colors of the confetti — accent + success + warning for a festive mix.
    const confettiColors = [accentColor, "#1FC16B", "#F5A623"];

    return (
      <AppBottomSheet ref={sheetRef} onDismiss={() => setBadgeId(null)}>
        {badge && (
          <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 8, gap: 14 }}>
            {/* Confetti burst origin (top-center of the sheet) */}
            <View key={burstKey} style={s.confettiOrigin} pointerEvents="none">
              {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
                <ConfettiPiece key={i} index={i} color={confettiColors[i % confettiColors.length]} />
              ))}
            </View>

            {/* Badge medallion */}
            <View
              style={[
                s.medallion,
                { backgroundColor: accentColor + "1f", borderColor: accentColor + "55" },
              ]}
            >
              <Text style={{ fontSize: 44 }}>{badge.icon}</Text>
            </View>

            <Text variant="labelXs" style={{ color: accentColor, letterSpacing: 1.5 }}>
              {badge.category === "streak"
                ? "STREAK UNLOCKED"
                : badge.category === "record"
                ? "NEW RECORD"
                : "MILESTONE UNLOCKED"}
            </Text>

            {/* Display-size headline — the celebrated thing */}
            <Text variant="display" style={{ color: "#F6F6F7", textAlign: "center" }}>
              {badge.name}
            </Text>

            <Text
              variant="paragraphM"
              style={{ color: "#9B9BA4", textAlign: "center", maxWidth: 280 }}
            >
              {badge.description}
            </Text>

            {/* Actions */}
            <View style={{ width: "100%", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={handleShare}
                style={[s.primaryBtn, { backgroundColor: accentColor }]}
              >
                <Text variant="labelL" style={{ color: accentColorContrast }}>
                  Share
                </Text>
              </Pressable>
              <Pressable onPress={() => sheetRef.current?.dismiss()} style={s.secondaryBtn}>
                <Text variant="labelL" style={{ color: "#9B9BA4" }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </AppBottomSheet>
    );
  }
);

const s = StyleSheet.create({
  confettiOrigin: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 0,
    height: 0,
    zIndex: 10,
  },
  medallion: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
