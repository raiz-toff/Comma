import React, { useCallback, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { Text } from "../src/components/ui/text";
import { COLORS, withAlpha } from "../src/theme/colors";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  buildActivationItems,
  type ActivationItem,
} from "../src/services/onboarding/activationChecklist";
import { requestFullLocationAccess } from "../src/services/permissions/locationAccess";

/**
 * Dashboard card holding the setup the wizard no longer asks for.
 *
 * Re-derives on focus rather than on mount, so an item ticks itself the moment the driver comes
 * back from the screen they just used to satisfy it.
 *
 * There is deliberately NO dismiss control. A driver who waves this away is precisely the one who
 * never comes back to add their real vehicle or turn on tracking — and then quietly under-claims
 * their mileage for months. It leaves on its own, once every item is genuinely done.
 */
export function ActivationChecklist() {
  const { profile, isDemoMode } = useSettingsStore();
  const [items, setItems] = useState<ActivationItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const next = await buildActivationItems(profile);
        if (!alive) return;
        setItems(next);
      })();
      return () => {
        alive = false;
      };
    }, [profile])
  );

  const handlePress = async (item: ActivationItem) => {
    if (item.done || busy) return;

    if (item.id === "gps") {
      setBusy(true);
      try {
        // Explains itself and walks the driver to Settings if they land on a partial grant, so a
        // "while using the app" tap doesn't quietly leave tracking half-broken.
        await requestFullLocationAccess();
        setItems(await buildActivationItems(profile));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (item.route) router.push(item.route as any);
  };

  // Demo mode is someone kicking the tyres on sample data. Asking them to configure a real vehicle
  // or grant background location is nonsense — none of it applies to a vault they're about to throw
  // away, and the items would tick against seeded demo records rather than anything they did.
  if (isDemoMode) return null;
  if (!items) return null;

  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.lineSubtle,
        borderRadius: 20,
        padding: 18,
        gap: 14,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text variant="labelL">Finish setting up</Text>
        <Text variant="paragraphS" style={{ color: COLORS.contentMuted }}>
          {done} of {items.length} done — each one sharpens your numbers.
        </Text>
      </View>

      {/* Progress */}
      <View style={{ flexDirection: "row", gap: 4 }}>
        {items.map((i) => (
          <View
            key={i.id}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              backgroundColor: i.done ? COLORS.success : COLORS.surface04,
            }}
          />
        ))}
      </View>

      <View style={{ gap: 2 }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handlePress(item)}
            disabled={item.done}
            accessibilityRole="button"
            accessibilityState={{ checked: item.done, disabled: item.done }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 11,
              opacity: item.done ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: item.done ? withAlpha(COLORS.success, 0.15) : "transparent",
                borderWidth: item.done ? 0 : 1.5,
                borderColor: COLORS.lineStrong,
              }}
            >
              {item.done && <Check size={12} color={COLORS.success} strokeWidth={3} />}
            </View>

            <View style={{ flex: 1, gap: 1 }}>
              <Text
                variant="labelM"
                style={{
                  color: item.done ? COLORS.contentMuted : COLORS.contentPrimary,
                  textDecorationLine: item.done ? "line-through" : "none",
                }}
              >
                {item.title}
              </Text>
              {!item.done && (
                <Text variant="paragraphS" style={{ color: COLORS.contentMuted }}>
                  {item.detail}
                </Text>
              )}
            </View>

            {busy && item.id === "gps" ? (
              <ActivityIndicator size="small" color={COLORS.contentMuted} />
            ) : (
              !item.done && <ChevronRight size={16} color={COLORS.contentMuted} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
