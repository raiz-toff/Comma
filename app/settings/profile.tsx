import React, { useState } from "react";
import {
  View, TextInput, ScrollView, Pressable, Alert,
  StyleSheet, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { getCountryDef, getRegionsByCountry, listCaProvinceCodes, listUsStateCodes } from "@/src/registry/index";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

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
  const { profile, updateProfile } = useSettingsStore();
  const { accentColor } = usePlatformTheme();

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
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ChevronLeft size={22} color="#a1a1aa" />
        </Pressable>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[s.saveBtn, { backgroundColor: accentColor }]}
        >
          {isSaving
            ? <Text style={s.saveBtnText}>Saving…</Text>
            : <><Check size={14} color="#000" /><Text style={s.saveBtnText}>Save</Text></>
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <SectionLabel text="Display Name" />
        <View style={s.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#52525b"
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
                style={[s.optionRow, i < COUNTRIES.length - 1 && s.optionRowBorder]}
              >
                <Text style={[s.optionText, sel && { color: accentColor, fontWeight: "700" }]}>{c.label}</Text>
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
                  style={[s.chip, sel && { backgroundColor: accentColor }]}
                >
                  <Text style={[s.chipText, sel && { color: "#000", fontWeight: "700" }]}>{r}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Distance unit — locked, derived from country */}
        <SectionLabel text="Distance Unit" />
        <View style={[s.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <Text style={s.lockedLabel}>{distanceUnit === "km" ? "Kilometres (km)" : "Miles (mi)"}</Text>
          <View style={s.lockedBadge}>
            <Text style={s.lockedBadgeText}>Auto · set by country</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c0b09" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: "#1f1e1c",
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  saveBtnText: { fontSize: 13, fontWeight: "800", color: "#000" },
  scroll: { padding: 16, gap: 6, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#71717a",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginTop: 10, marginBottom: 4, marginLeft: 4,
  },
  card: {
    backgroundColor: "#1a1916", borderRadius: 14,
    borderWidth: 0.5, borderColor: "#2a2825",
    overflow: "hidden",
  },
  nameInput: {
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: "600", color: "#fff",
  },
  optionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionRowBorder: { borderBottomWidth: 0.5, borderBottomColor: "#2a2825" },
  optionText: { fontSize: 15, fontWeight: "500", color: "#d4d4d8" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "#262422", borderWidth: 0.5, borderColor: "#3a3835",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: "#a1a1aa" },
  lockedLabel: { fontSize: 15, fontWeight: "600", color: "#d4d4d8", paddingHorizontal: 16, paddingVertical: 14 },
  lockedBadge: {
    backgroundColor: "#262422", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: 16,
  },
  lockedBadgeText: { fontSize: 10, fontWeight: "700", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.4 },
});
