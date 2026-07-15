import React, { useState } from "react";
import {
  View, TextInput, ScrollView, Pressable, Alert,
  StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { getCountryDef, getRegionsByCountry, listCaProvinceCodes } from "@/src/registry/index";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useLayout } from "@/src/hooks/useLayout";

const COUNTRIES = [
  { id: "CA", label: "🇨🇦 Canada" },
  // uncomment as more country modules are built:
  // { id: "US", label: "🇺🇸 United States" },
  // { id: "UK", label: "🇬🇧 United Kingdom" },
  // { id: "NP", label: "🇳🇵 Nepal" },
] as const;

type CountryId = "CA" | "US" | "UK" | "NP";

function regionLabel(country: CountryId) {
  if (country === "CA") return "Province";
  if (country === "US") return "State";
  return "Region";
}

function getRegions(country: CountryId): string[] {
  const defs = getRegionsByCountry(country);
  return defs.map((r) => r.id);
}

export default function ProfileEditScreen() {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { profile, updateProfile } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const { columnStyle } = useLayout();

  const [name, setName] = useState(profile?.displayName ?? "");
  const [country, setCountry] = useState<CountryId>((profile?.country as CountryId) ?? "CA");
  const [region, setRegion] = useState(profile?.taxRegion ?? "ON");
  const [isSaving, setIsSaving] = useState(false);

  const countryDef = getCountryDef(country);
  const distanceUnit = countryDef.distanceUnit;
  const regions = getRegions(country);

  const handleCountryChange = (newCountry: CountryId) => {
    if (newCountry === country) return;
    if (newCountry !== profile?.country) {
      Alert.alert(
        "Change Country?",
        `Switching to ${COUNTRIES.find(c => c.id === newCountry)?.label ?? newCountry} will update your currency, distance unit, and tax region to defaults.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Change",
            style: "destructive",
            onPress: () => {
              const def = getCountryDef(newCountry);
              setCountry(newCountry);
              setRegion(def.tax.defaultRegionCode);
            },
          },
        ]
      );
    } else {
      setCountry(newCountry);
      setRegion(profile?.taxRegion ?? countryDef.tax.defaultRegionCode);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: name.trim() || profile?.displayName || "Driver",
        country: country as DriverProfile["country"],
        taxRegion: region,
        distanceUnit,
      });
      router.back();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header — outside the ScrollView, so it takes the same cap as the content. */}
      <View style={[s.header, columnStyle]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.backBtn}
          hitSlop={12}
        >
          <ChevronLeft size={22} color={C.contentSecondary} />
        </Pressable>
        <Text variant="headingS">Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          accessibilityState={{ disabled: isSaving }}
          style={[s.saveBtn, { backgroundColor: accentColor }]}
        >
          {isSaving
            ? <Text variant="labelM" style={{ color: accentColorContrast }}>Saving…</Text>
            : <><Check size={14} color={accentColorContrast} /><Text variant="labelM" style={{ color: accentColorContrast }}>Save</Text></>
          }
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, columnStyle]} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <SectionLabel text="Display Name" />
        <View style={s.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={C.contentMuted}
            style={s.nameInput}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Country */}
        <SectionLabel text="Country" />
        <View style={s.card}>
          {COUNTRIES.map((c, i) => {
            const sel = c.id === country;
            return (
              <Pressable
                key={c.id}
                onPress={() => handleCountryChange(c.id as CountryId)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[s.optionRow, i < COUNTRIES.length - 1 && s.optionRowBorder]}
              >
                <Text variant="labelL" style={[s.optionText, sel && { color: accentColor, fontWeight: "700" }]}>{c.label}</Text>
                {sel && <Check size={16} color={accentColor} />}
              </Pressable>
            );
          })}
        </View>

        {/* Region */}
        <SectionLabel text={regionLabel(country)} />
        <View style={s.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 4 }}>
            {regions.map((r) => {
              const sel = r === region;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRegion(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  style={[s.chip, sel && { backgroundColor: accentColor }]}
                >
                  <Text variant="labelM" style={[s.chipText, sel && { color: accentColorContrast, fontWeight: "700" }]}>{r}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Distance unit — locked, derived from country */}
        <SectionLabel text="Distance Unit" />
        <View style={[s.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <Text variant="labelL" style={s.lockedLabel}>{distanceUnit === "km" ? "Kilometres (km)" : "Miles (mi)"}</Text>
          <View style={s.lockedBadge}>
            <Text variant="labelXs" className="text-content-secondary">Auto · set by country</Text>
          </View>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  const s = useThemedStyles(makeStyles);
  return <Text variant="labelXs" className="text-content-secondary" style={s.sectionLabel}>{text}</Text>;
}

const makeStyles = (C: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: C.lineSubtle,
  },
  backBtn: { padding: 4, width: 40 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  scroll: { padding: 16, gap: 6, paddingBottom: 48 },
  sectionLabel: {
    marginTop: 10, marginBottom: 4, marginLeft: 4,
  },
  card: {
    backgroundColor: C.surface02, borderRadius: 16,
    borderWidth: 0.5, borderColor: C.lineStrong,
    overflow: "hidden",
  },
  nameInput: {
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: "600", color: C.contentPrimary,
  },
  optionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.lineStrong },
  optionText: { color: C.contentSecondary },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: C.surface04, borderWidth: 0.5, borderColor: C.lineStrong,
  },
  chipText: { color: C.contentSecondary },
  lockedLabel: { color: C.contentSecondary, paddingHorizontal: 16, paddingVertical: 14 },
  lockedBadge: {
    backgroundColor: C.surface04, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 16,
  },
});
