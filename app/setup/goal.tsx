import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useLayout } from "@/src/hooks/useLayout";
import { getCountryDef } from "@/src/registry/countries/index";
import { getGoalsWithProgress, insertGoal, updateGoal } from "@/src/database/queries/goals";
import { useSettingsStore } from "@/store/useSettingsStore";
import { markActivationDone } from "@/src/services/onboarding/activationChecklist";

const PRESETS = [400, 500, 750, 1000];

/**
 * "Set a weekly goal" — the dashboard checklist's goal step.
 *
 * A dedicated screen rather than the full Goals manager: the checklist promises one decision, and
 * the Goals screen offers goal types, periods, units and a list to manage — which is why tapping
 * the item appeared to do nothing useful. This asks for one number.
 *
 * Writes to the weekly earnings row in the goals table (the same row the dashboard's progress card
 * reads), and records completion explicitly so that keeping the seeded default still counts.
 */
export default function SetupGoalScreen() {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { columnStyle } = useLayout();
  const { profile, updateProfile } = useSettingsStore();
  const queryClient = useQueryClient();
  const currency = getCountryDef(profile?.country ?? "CA").symbol;

  const [amount, setAmount] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const goals = await getGoalsWithProgress();
        const weekly = goals.find(
          (g: any) => g.period === "weekly" && (g.unit === "currency" || g.id === "goal_weekly")
        );
        if (weekly) {
          setExistingId(weekly.id);
          setAmount(String(Math.round(Number(weekly.targetValue) || 0)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    const target = Number(amount);
    if (!(target > 0)) {
      setError("Enter a weekly target above zero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (existingId) {
        await updateGoal(existingId, { targetValue: target, isActive: true });
      } else {
        await insertGoal({
          id: "goal_weekly",
          label: "Weekly Revenue Goal",
          targetValue: target,
          unit: "currency",
          period: "weekly",
          isActive: true,
          createdAt: new Date(),
        } as any);
      }

      // Keep the profile's derived targets in step, so analytics and the tax screens don't keep
      // projecting from the old figure.
      await updateProfile({
        weeklyGoal: target,
        monthlyGoal: Math.round(target * 4.33),
        annualGoal: Math.round(target * 52),
      });

      await markActivationDone("goal");
      queryClient.invalidateQueries();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const parsed = Number(amount) || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/*
          The back button and the CTA footer are siblings of the ScrollView, not children of
          it, so they need the same cap as the form — otherwise on a tablet they run the full
          width of the screen while the form they belong to sits in a centred 640pt column.
          `columnStyle` is undefined below 600pt, so none of this changes a phone.
        */}
        <View style={[s.header, columnStyle]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
            <ChevronLeft size={24} color={C.contentPrimary} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.contentPrimary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView
            contentContainerStyle={[{ paddingHorizontal: 24, paddingBottom: 24 }, columnStyle]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 6, marginBottom: 28 }}>
              <Text variant="headingXl">What's your weekly target?</Text>
              <Text variant="paragraphM" style={{ color: C.contentMuted }}>
                Every shift gets measured against this, so you know mid-week whether you're on pace
                — instead of finding out on Sunday.
              </Text>
            </View>

            <View style={s.amountRow}>
              <Text variant="display" style={{ color: C.contentMuted }}>
                {currency}
              </Text>
              <TextInput
                value={amount}
                onChangeText={(v) => {
                  setAmount(v.replace(/[^0-9]/g, ""));
                  setError("");
                }}
                placeholder="500"
                placeholderTextColor={C.contentMuted}
                keyboardType="numeric"
                style={s.amountInput}
                autoFocus
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
              {PRESETS.map((v) => {
                const on = parsed === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => {
                      setAmount(String(v));
                      setError("");
                    }}
                    accessibilityRole="button"
                    style={[s.chip, on && s.chipOn]}
                  >
                    <Text
                      variant="labelM"
                      style={{ color: on ? C.contentPrimary : C.contentSecondary }}
                    >
                      {currency}
                      {v.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {parsed > 0 && (
              <Text variant="paragraphS" style={{ color: C.contentMuted, marginTop: 20 }}>
                That's about {currency}
                {Math.round(parsed * 4.33).toLocaleString()} a month, or {currency}
                {(parsed * 52).toLocaleString()} a year.
              </Text>
            )}

            {error ? (
              <Text variant="paragraphS" style={{ color: C.destructive, marginTop: 12 }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View style={[s.footer, columnStyle]}>
          <Pressable
            onPress={handleSave}
            disabled={saving || loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || loading }}
            style={[s.cta, (saving || loading) && { opacity: 0.4 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.background} />
            ) : (
              <Text variant="labelL" style={{ color: C.background }}>
                Set my goal
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: "700",
    color: C.contentPrimary,
    padding: 0,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
  },
  chipOn: { borderColor: C.contentPrimary, backgroundColor: C.surface04 },
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
