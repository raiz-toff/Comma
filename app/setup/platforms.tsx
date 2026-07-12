import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { PlatformLogo } from "@/src/components/GlobalTopHeader";
import { getPlatformsByCountry, PLATFORM_REGISTRY } from "@/src/registry/platforms";
import { getDBPlatforms, updateDBPlatform } from "@/src/database/queries/platforms";
import { useSettingsStore } from "@/store/useSettingsStore";
import { markActivationDone } from "@/src/services/onboarding/activationChecklist";

/**
 * "Add your other apps" — the dashboard checklist's platform step.
 *
 * A dedicated screen rather than a jump into Settings: the checklist promises one specific job,
 * and dropping the driver into a page of unrelated toggles makes them hunt for it (and often
 * leave without doing it). This does exactly the one thing, saves, and comes back.
 */
export default function SetupPlatformsScreen() {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { profile } = useSettingsStore();
  const queryClient = useQueryClient();
  const country = profile?.country ?? "CA";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const available = getPlatformsByCountry(country);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getDBPlatforms(country);
        setSelected(new Set(rows.filter((p: any) => p.isActive).map((p: any) => p.id)));
      } finally {
        setLoading(false);
      }
    })();
  }, [country]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (saving || selected.size === 0) return;
    setSaving(true);
    try {
      // Write every platform's state, not just the additions — an unticked app has to actually
      // switch off, or the driver's per-platform comparison keeps counting somewhere they quit.
      await Promise.all(
        available.map((p) =>
          updateDBPlatform(country, p.id, { isActive: selected.has(p.id) } as any)
        )
      );
      await markActivationDone("platforms");
      queryClient.invalidateQueries();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
          <ChevronLeft size={24} color={C.contentPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <View style={{ gap: 6, marginBottom: 24 }}>
          <Text variant="headingXl">Which apps do you drive for?</Text>
          <Text variant="paragraphM" style={{ color: C.contentMuted }}>
            Pick every one you earn on. Comma works out what each really pays you per hour, after
            costs — which is usually not the one you'd guess.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.contentPrimary} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ gap: 8 }}>
            {available.map((p) => {
              const on = selected.has(p.id);
              const hasLogo = !!PLATFORM_REGISTRY[p.id]?.logo;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => toggle(p.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[s.tile, on && s.tileOn]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    {hasLogo ? (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: withAlpha(p.color, 0.12),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PlatformLogo id={p.id} size={18} />
                      </View>
                    ) : (
                      <View
                        style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }}
                      />
                    )}
                    <Text
                      variant="labelL"
                      style={{ color: on ? C.contentPrimary : C.contentSecondary }}
                    >
                      {p.label}
                    </Text>
                  </View>
                  {on && <Check size={16} color={C.contentPrimary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          onPress={handleSave}
          disabled={saving || selected.size === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || selected.size === 0 }}
          style={[s.cta, (saving || selected.size === 0) && { opacity: 0.4 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.background} />
          ) : (
            <Text variant="labelL" style={{ color: C.background }}>
              {selected.size === 0
                ? "Pick at least one"
                : `Save ${selected.size} app${selected.size === 1 ? "" : "s"}`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 16,
    padding: 16,
  },
  tileOn: { borderColor: C.contentPrimary, backgroundColor: C.surface04 },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineSubtle,
  },
  cta: {
    backgroundColor: C.contentPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
