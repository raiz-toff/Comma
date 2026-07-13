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
import { Car, Bike, Zap, ChevronLeft } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useLayout } from "@/src/hooks/useLayout";
import { getVehicles, updateVehicle } from "@/src/database/queries/vehicles";
import { upsertTaxProfile } from "@/src/database/queries/taxProfiles";
import { getVehicleMileageEligibility } from "@/src/registry/countries/mileageRates";
import { useSettingsStore } from "@/store/useSettingsStore";
import { markActivationDone } from "@/src/services/onboarding/activationChecklist";

const VEHICLE_TYPES = [
  { id: "gas", label: "Gas", Icon: Car },
  { id: "hybrid", label: "Hybrid", Icon: Car },
  { id: "ev", label: "Electric", Icon: Zap },
  { id: "scooter", label: "Scooter", Icon: Bike },
  { id: "ebike", label: "E-bike", Icon: Bike },
  { id: "bicycle", label: "Bicycle", Icon: Bike },
];

/**
 * "Tell us your real vehicle" — the dashboard checklist's vehicle step.
 *
 * Edits the placeholder gas car onboarding created, rather than sending the driver to the vehicle
 * list to add a *second* one. That was the old behaviour and it never satisfied the checklist: the
 * placeholder stayed there with no make on it, so the item could never tick no matter how many
 * vehicles they added.
 *
 * Saving also re-derives the tax profile from the chosen type. Without that, switching a gas car
 * to a bicycle would leave the seeded car rate in place and keep claiming a write-off the driver
 * isn't entitled to.
 */
export default function SetupVehicleScreen() {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { columnStyle } = useLayout();
  const { profile } = useSettingsStore();
  const queryClient = useQueryClient();
  const country = profile?.country ?? "CA";
  const distanceUnit = profile?.distanceUnit ?? "km";

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("gas");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await getVehicles();
        const v = list.find((x: any) => x.isActive) ?? list[0] ?? null;
        if (v) {
          setVehicleId(v.id);
          setName(v.name ?? "");
          setType(v.type ?? "gas");
          setMake(v.make ?? "");
          setModel(v.model ?? "");
          setYear(v.year ? String(v.year) : "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Shown live, so the driver can see the rate change as they pick a type.
  const eligibility = getVehicleMileageEligibility(country, type);

  const handleSave = async () => {
    if (saving || !vehicleId) return;
    if (!make.trim()) {
      setError("Add the make (Toyota, Honda…) so we can set the right rate.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const parsedYear = year.trim() ? Number(year.trim()) : null;
      await updateVehicle(vehicleId, {
        name: name.trim() || "My Vehicle",
        type,
        make: make.trim(),
        model: model.trim(),
        year: Number.isFinite(parsedYear) ? (parsedYear as number) : null,
      } as any);

      // Re-derive the write-off rate from the type they just chose.
      const taxYear = new Date().getFullYear();
      await upsertTaxProfile({
        id: `tp_${vehicleId}_${taxYear}`,
        vehicleId,
        taxYear,
        country,
        deductionMethod: eligibility.eligible ? "standard_mileage" : "actual_expenses",
        standardRatePrimary: eligibility.ratePrimary,
        standardRateSecondary: eligibility.rateSecondary,
        rateThreshold: eligibility.rateThreshold,
      } as any);

      await markActivationDone("vehicle");
      queryClient.invalidateQueries();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

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
            <View style={{ gap: 6, marginBottom: 24 }}>
              <Text variant="headingXl">What do you drive?</Text>
              <Text variant="paragraphM" style={{ color: C.contentMuted }}>
                We assumed a gas car to get you started. Your real one sets the correct write-off
                rate per {distanceUnit}.
              </Text>
            </View>

            <View style={{ gap: 8, marginBottom: 22 }}>
              <Text variant="labelXs" style={{ color: C.contentMuted }}>
                TYPE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {VEHICLE_TYPES.map(({ id, label, Icon }) => {
                  const on = type === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setType(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <Icon
                        size={16}
                        color={on ? C.contentPrimary : C.contentMuted}
                      />
                      <Text
                        variant="labelM"
                        style={{ color: on ? C.contentPrimary : C.contentSecondary }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* The consequence of the choice above, stated in money. */}
            <View
              style={{
                backgroundColor: eligibility.eligible
                  ? withAlpha(C.success, 0.08)
                  : C.surface03,
                borderWidth: 1,
                borderColor: eligibility.eligible
                  ? withAlpha(C.success, 0.25)
                  : C.lineSubtle,
                borderRadius: 14,
                padding: 14,
                marginBottom: 22,
                gap: 3,
              }}
            >
              <Text variant="labelM">
                {eligibility.eligible
                  ? `Write-off: ${eligibility.ratePrimary} per ${distanceUnit}`
                  : "No standard mileage write-off"}
              </Text>
              <Text variant="paragraphS" style={{ color: C.contentSecondary }}>
                {eligibility.label}
              </Text>
            </View>

            <Field label="MAKE" value={make} onChange={setMake} placeholder="Toyota" />
            <Field label="MODEL (OPTIONAL)" value={model} onChange={setModel} placeholder="Corolla" />
            <Field
              label="YEAR (OPTIONAL)"
              value={year}
              onChange={setYear}
              placeholder="2020"
              keyboardType="numeric"
            />
            <Field
              label="NICKNAME (OPTIONAL)"
              value={name}
              onChange={setName}
              placeholder="My Car"
            />

            {error ? (
              <Text variant="paragraphS" style={{ color: C.destructive, marginTop: 6 }}>
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
                Save my vehicle
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <Text variant="labelXs" style={{ color: C.contentMuted }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.contentMuted}
        keyboardType={keyboardType}
        style={s.input}
      />
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
  },
  chipOn: { borderColor: C.contentPrimary, backgroundColor: C.surface04 },
  input: {
    fontSize: 16,
    fontWeight: "600",
    color: C.contentPrimary,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
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
