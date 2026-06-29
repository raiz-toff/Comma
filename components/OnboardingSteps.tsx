import React, { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../src/components/ui/text";
import { getPlatformsByCountry, PLATFORMS } from "../src/registry/platforms";
import { getRegionsByCountry } from "../src/registry/countries/index";
import { type FeatureKey } from "../src/registry/modules";
import {
  Car,
  Bike,
  Zap,
  Check,
  Navigation,
  Sun,
  Moon,
  Smartphone,
} from "lucide-react-native";

// ─── Shared primitives ────────────────────────────────────────────────────────

function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 28 }}>
      <Text style={s.heading}>{title}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={s.fieldLabel}>{label}</Text>;
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  suffix,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  prefix?: string;
  suffix?: string;
}) {
  return (
    <View style={s.inputRow}>
      {prefix && <Text style={s.inputAffix}>{prefix}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7a7670"
        keyboardType={keyboardType}
        style={[s.input, { flex: 1 }]}
      />
      {suffix && <Text style={s.inputAffix}>{suffix}</Text>}
    </View>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

export function WelcomeScreen({
  onStart,
  onDemo,
}: {
  onStart: () => void;
  onDemo: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000000",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: 28,
          paddingVertical: 32,
        }}
      >
        {/* Logo */}
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ fontSize: 30, fontWeight: "900", color: "#000000" }}
            >
              C
            </Text>
          </View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#ffffff",
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginTop: 14,
            }}
          >
            COMMA
          </Text>
        </View>

        {/* Hero */}
        <View style={{ alignItems: "center", gap: 14 }}>
          <Text
            style={{
              fontSize: 38,
              fontWeight: "800",
              color: "#f4f2ed",
              textAlign: "center",
              letterSpacing: -0.5,
              lineHeight: 46,
            }}
          >
            Stop guessing{"\n"}what you made.
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: "#7a7670",
              textAlign: "center",
              lineHeight: 24,
              maxWidth: 260,
            }}
          >
            Every dollar earned. Every mile driven. Every deduction tracked —
            all on your device.
          </Text>
        </View>

        {/* CTAs */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={onStart}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#000000",
                letterSpacing: 0.2,
              }}
            >
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={onDemo}
            style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#7a7670" }}>
              Try with demo data
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: 11,
              color: "#52525b",
              textAlign: "center",
              fontWeight: "600",
              letterSpacing: 0.3,
              marginTop: 4,
            }}
          >
            No account required · No data leaves your device
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Step 0 — Name ────────────────────────────────────────────────────────────

export function NameStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="What should we call you?"
        sub="Appears on your dashboard and in exported reports."
      />
      <StyledInput
        value={value}
        onChangeText={onChange}
        placeholder="Your first name"
      />
    </View>
  );
}

// ─── Step 1 — Country ─────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "CA" as const, flag: "🇨🇦", label: "Canada", sub: "CAD · km" },
  // { code: "US" as const, flag: "🇺🇸", label: "United States", sub: "USD · miles" },
  // { code: "UK" as const, flag: "🇬🇧", label: "United Kingdom", sub: "GBP · miles" },
  // { code: "NP" as const, flag: "🇳🇵", label: "Nepal", sub: "NPR · km" },
];

export function CountryStep({
  value,
  onChange,
}: {
  value: "US" | "CA" | "UK" | "NP";
  onChange: (c: "US" | "CA" | "UK" | "NP") => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="Where do you work?"
        sub="Sets your currency, distance unit, and tax rules automatically."
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {COUNTRIES.map(({ code, flag, label, sub }) => {
          const selected = value === code;
          return (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              style={[s.countryTile, selected && s.tileSelected]}
            >
              <Text style={{ fontSize: 28 }}>{flag}</Text>
              <Text
                style={[
                  s.tileTitle,
                  { textAlign: "center" },
                  selected && { color: "#f4f2ed" },
                ]}
              >
                {label}
              </Text>
              <Text style={[s.tileSub, { textAlign: "center" }]}>{sub}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 2 — Region ──────────────────────────────────────────────────────────

export function RegionStep({
  country,
  value,
  onChange,
}: {
  country: "US" | "CA" | "UK" | "NP";
  value: string;
  onChange: (r: string) => void;
}) {
  const regions = getRegionsByCountry(country);
  const label =
    country === "CA"
      ? "Province or territory"
      : country === "US"
      ? "State"
      : "Region";

  return (
    <View style={{ flex: 1 }}>
      <StepHeading title={label} sub="Used for regional tax presets and mileage rates." />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          {regions.map((r) => {
            const selected = value === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => onChange(r.id)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: selected
                    ? "rgba(255,255,255,0.05)"
                    : "#0d0d0d",
                  borderWidth: 1,
                  borderColor: selected ? "#ffffff" : "#1f1f1f",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: selected ? "#f4f2ed" : "#c8c4bb",
                  }}
                >
                  {r.label}
                </Text>
                {selected && (
                  <Check size={14} color="#ffffff" strokeWidth={2.5} />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 3 — Platforms ───────────────────────────────────────────────────────

export function PlatformStep({
  country,
  selectedPlatforms,
  togglePlatform,
}: {
  country: string;
  selectedPlatforms: string[];
  togglePlatform: (id: string) => void;
}) {
  const platforms = getPlatformsByCountry(country);

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="Which platforms do you use?"
        sub="Select all that apply. You can change this anytime in Settings."
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          {platforms.map((p) => {
            const selected = selectedPlatforms.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => togglePlatform(p.id)}
                style={[s.tile, selected && s.tileSelected]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: p.color,
                    }}
                  />
                  <Text
                    style={[s.tileTitle, selected && { color: "#f4f2ed" }]}
                  >
                    {p.label}
                  </Text>
                </View>
                {selected && (
                  <Check size={14} color="#ffffff" strokeWidth={2.5} />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 4 — Vehicle ─────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { id: "gas", label: "Gas", Icon: Car },
  { id: "hybrid", label: "Hybrid", Icon: Car },
  { id: "ev", label: "Electric", Icon: Zap },
  { id: "scooter", label: "Scooter", Icon: Car },
  { id: "ebike", label: "E-bike", Icon: Bike },
  { id: "bicycle", label: "Bicycle", Icon: Bike },
];

export function VehicleStep({
  nickname,
  setNickname,
  type,
  setType,
  make,
  setMake,
  model,
  setModel,
  year,
  setYear,
}: {
  nickname: string;
  setNickname: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  make: string;
  setMake: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <StepHeading
        title="Your vehicle"
        sub="Used to calculate fuel costs and maintenance over time."
      />
      <View style={{ gap: 20 }}>
        <View style={{ gap: 8 }}>
          <FieldLabel label="Nickname" />
          <StyledInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. My Prius, E-Bike"
          />
        </View>

        <View style={{ gap: 8 }}>
          <FieldLabel label="Type" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {VEHICLE_TYPES.map(({ id, label, Icon }) => {
              const selected = type === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setType(id)}
                  style={[s.chip, selected && s.chipSelected]}
                >
                  <Icon
                    size={14}
                    color={selected ? "#ffffff" : "#7a7670"}
                    strokeWidth={2}
                  />
                  <Text
                    style={[s.chipText, selected && { color: "#ffffff" }]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <FieldLabel label="Make" />
            <StyledInput
              value={make}
              onChangeText={setMake}
              placeholder="Toyota"
            />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <FieldLabel label="Model" />
            <StyledInput
              value={model}
              onChangeText={setModel}
              placeholder="Prius"
            />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <FieldLabel label="Year (optional)" />
          <StyledInput
            value={year}
            onChangeText={setYear}
            placeholder="2020"
            keyboardType="numeric"
          />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Step 5 — Goal ────────────────────────────────────────────────────────────

export function GoalStep({
  value,
  onChange,
  country,
}: {
  value: string;
  onChange: (v: string) => void;
  country: string;
}) {
  const num = Number(value) || 0;
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";
  const pct = Math.min((num / 1000) * 100, 100);

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="What would a great week look like?"
        sub="Sets your weekly earnings target. You can change this anytime."
      />
      <View style={{ gap: 24 }}>
        <StyledInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          prefix={currencySymbol}
          suffix="/ week"
          placeholder="500"
        />

        {/* Progress bar */}
        <View style={{ gap: 8 }}>
          <View
            style={{
              height: 6,
              backgroundColor: "#262522",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                backgroundColor: "#ffffff",
                borderRadius: 3,
                width: `${pct}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10, color: "#52525b", fontWeight: "600" }}>
              {currencySymbol}0
            </Text>
            <Text style={{ fontSize: 10, color: "#52525b", fontWeight: "600" }}>
              {currencySymbol}1,000
            </Text>
          </View>
        </View>

        {num > 0 && (
          <View
            style={{
              backgroundColor: "#0d0d0d",
              borderWidth: 1,
              borderColor: "#1f1f1f",
              borderRadius: 14,
              padding: 16,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: "#7a7670",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              That works out to
            </Text>
            <Text
              style={{ fontSize: 20, fontWeight: "800", color: "#f4f2ed" }}
            >
              {currencySymbol}
              {Math.round(num * 4.33).toLocaleString()} / month
            </Text>
            <Text style={{ fontSize: 13, color: "#7a7670" }}>
              {currencySymbol}
              {(num * 52).toLocaleString()} / year
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Step 6 — GPS permission ──────────────────────────────────────────────────

export function GPSStep({ onNext }: { onNext: () => void }) {
  const handleRequest = async () => {
    try {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch {
      // simulator or web — silently continue
    }
    try {
      const Notifications = await import("expo-notifications");
      await Notifications.requestPermissionsAsync();
    } catch {
      // silently continue
    }
    onNext();
  };

  return (
    <View style={{ flex: 1, justifyContent: "space-between" }}>
      <View>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.20)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <Navigation size={28} color="#ffffff" strokeWidth={1.5} />
        </View>
        <StepHeading
          title="Automatic mileage tracking"
          sub="Comma tracks your mileage in the background while you drive — so you never have to log it manually."
        />
        <View style={{ gap: 12 }}>
          {[
            "Active delivery miles separated from dead miles automatically",
            "Mileage logged in the background during active shifts",
            "All location data stays 100% on your device",
          ].map((point) => (
            <View
              key={point}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                <Check size={10} color="#ffffff" strokeWidth={3} />
              </View>
              <Text
                style={{ fontSize: 14, color: "#c8c4bb", flex: 1, lineHeight: 20 }}
              >
                {point}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={handleRequest}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            paddingVertical: 17,
            alignItems: "center",
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: "#000000" }}
          >
            Enable GPS tracking
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          style={{ paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#7a7670" }}>
            Skip — I'll enter mileage manually
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 6 — Appearance ─────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { id: "#10b981", label: "Emerald" },
  { id: "#3b82f6", label: "Blue" },
  { id: "#f59e0b", label: "Amber" },
  { id: "#f43f5e", label: "Rose" },
  { id: "#8b5cf6", label: "Violet" },
  { id: "#f97316", label: "Orange" },
] as const;

type ThemeOption = "dark" | "light" | "auto";

const THEME_OPTIONS: { id: ThemeOption; label: string; sub: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }> }[] = [
  { id: "dark", label: "Dark", sub: "Easy on the eyes", Icon: Moon },
  { id: "light", label: "Light", sub: "Classic bright look", Icon: Sun },
  { id: "auto", label: "Auto", sub: "Follows your system", Icon: Smartphone },
];

export function AppearanceStep({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
}: {
  theme: ThemeOption;
  setTheme: (v: ThemeOption) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <StepHeading
        title="Make it yours"
        sub="Choose a theme and accent color. You can change these anytime in Settings."
      />

      <View style={{ gap: 24 }}>
        {/* Theme */}
        <View style={{ gap: 10 }}>
          <Text style={s.fieldLabel}>Theme</Text>
          <View style={{ gap: 8 }}>
            {THEME_OPTIONS.map(({ id, label, sub, Icon }) => {
              const selected = theme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTheme(id)}
                  style={[s.tile, selected && s.tileSelected]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                    <View style={[s.iconBox, selected && s.iconBoxSelected]}>
                      <Icon size={18} color={selected ? "#ffffff" : "#7a7670"} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{label}</Text>
                      <Text style={s.tileSub}>{sub}</Text>
                    </View>
                  </View>
                  {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Accent color */}
        <View style={{ gap: 10 }}>
          <Text style={s.fieldLabel}>Accent colour</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {ACCENT_COLORS.map(({ id, label }) => {
              const selected = accentColor === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setAccentColor(id)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: id,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: selected ? 3 : 0,
                    borderColor: "#ffffff",
                  }}
                  accessibilityLabel={label}
                >
                  {selected && <Check size={16} color="#ffffff" strokeWidth={3} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Step 7 — Preferences & Features ─────────────────────────────────────────

const OPTIONAL_FEATURES: { key: FeatureKey; label: string; description: string }[] = [
  {
    key: "analytics_advanced",
    label: "Analytics Tab",
    description: "Charts for earnings by platform, best hours, and trends",
  },
  {
    key: "tax_workspace",
    label: "Tax Tab",
    description: "Estimate CPP, HST/GST, and quarterly installments",
  },
  {
    key: "goals",
    label: "Goals",
    description: "Track income, hours, and mileage targets with progress rings",
  },
  {
    key: "schedule",
    label: "Schedule",
    description: "Plan upcoming shifts on a calendar with local reminders",
  },
  {
    key: "pdf_reports",
    label: "PDF Reports",
    description: "Export printable earnings summaries",
  },
];

export function PreferencesStep({
  weekStartDay,
  setWeekStartDay,
  timeFormat,
  setTimeFormat,
  featureOverrides,
  toggleFeature,
}: {
  weekStartDay: number;
  setWeekStartDay: (v: number) => void;
  timeFormat: "12h" | "24h";
  setTimeFormat: (v: "12h" | "24h") => void;
  featureOverrides: Partial<Record<FeatureKey, boolean>>;
  toggleFeature: (key: FeatureKey) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <StepHeading
        title="Preferences"
        sub="Tune Comma to how you work. All of these can be changed later."
      />

      <View style={{ gap: 28 }}>
        {/* Week starts on */}
        <View style={{ gap: 10 }}>
          <Text style={s.fieldLabel}>Week starts on</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { value: 1, label: "Monday" },
              { value: 0, label: "Sunday" },
            ].map(({ value, label }) => {
              const selected = weekStartDay === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setWeekStartDay(value)}
                  style={[
                    s.chip,
                    selected && s.chipSelected,
                    { flex: 1, justifyContent: "center" },
                  ]}
                >
                  <Text
                    style={[
                      s.chipText,
                      selected && { color: "#ffffff" },
                      { textAlign: "center" },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Time format */}
        <View style={{ gap: 10 }}>
          <Text style={s.fieldLabel}>Time format</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { value: "12h" as const, label: "12-hour", sub: "3:00 PM" },
              { value: "24h" as const, label: "24-hour", sub: "15:00" },
            ].map(({ value, label, sub }) => {
              const selected = timeFormat === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTimeFormat(value)}
                  style={[
                    s.tile,
                    selected && s.tileSelected,
                    { flex: 1, flexDirection: "column", alignItems: "flex-start", gap: 4 },
                  ]}
                >
                  <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{label}</Text>
                  <Text style={s.tileSub}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Optional features */}
        <View style={{ gap: 10 }}>
          <Text style={s.fieldLabel}>Optional features</Text>
          <View style={{ gap: 8 }}>
            {OPTIONAL_FEATURES.map(({ key, label, description }) => {
              const enabled = featureOverrides[key] !== false;
              return (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#0d0d0d",
                    borderWidth: 1,
                    borderColor: "#1f1f1f",
                    borderRadius: 14,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#c8c4bb" }}>
                      {label}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#7a7670", marginTop: 2, lineHeight: 16 }}>
                      {description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleFeature(key)}
                    trackColor={{ false: "#27272a", true: "#10b981" }}
                    thumbColor="#ffffff"
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Reveal screen ────────────────────────────────────────────────────────────

export function RevealStep({
  displayName,
  selectedPlatforms,
  country,
  weeklyGoal,
  onEnter,
}: {
  displayName: string;
  selectedPlatforms: string[];
  country: string;
  weeklyGoal: string;
  onEnter: () => void;
}) {
  const insets = useSafeAreaInsets();
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000000",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        {/* Success mark */}
        <View style={{ alignItems: "center", gap: 20 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.20)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={28} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: "#f4f2ed",
                textAlign: "center",
                letterSpacing: -0.3,
              }}
            >
              {displayName ? `You're all set, ${displayName}` : "You're all set"}
            </Text>
            <Text
              style={{ fontSize: 14, color: "#7a7670", textAlign: "center" }}
            >
              Start your first shift to see your numbers come alive.
            </Text>
          </View>
        </View>

        {/* Summary card */}
        <View
          style={{
            backgroundColor: "#0d0d0d",
            borderWidth: 1,
            borderColor: "#1f1f1f",
            borderRadius: 20,
            padding: 20,
            gap: 16,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#7a7670",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Your setup
          </Text>

          <View style={{ gap: 12 }}>
            {selectedPlatforms.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Text style={{ fontSize: 13, color: "#7a7670" }}>
                  Platforms
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 4,
                    maxWidth: "60%",
                    justifyContent: "flex-end",
                  }}
                >
                  {selectedPlatforms.slice(0, 4).map((pid) => {
                    const p = PLATFORMS[pid as keyof typeof PLATFORMS];
                    return (
                      <View
                        key={pid}
                        style={{
                          backgroundColor: p?.color ?? "#27272a",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "800",
                            color: p?.textColor ?? "#fff",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {p?.label ?? pid}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={{ fontSize: 13, color: "#7a7670" }}>
                Weekly goal
              </Text>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}
              >
                {currencySymbol}
                {Number(weeklyGoal).toLocaleString()} / week
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          onPress={onEnter}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            paddingVertical: 17,
            alignItems: "center",
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: "#000000" }}
          >
            Go to my dashboard
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f4f2ed",
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  sub: {
    fontSize: 14,
    color: "#7a7670",
    lineHeight: 20,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    padding: 16,
  },
  tileSelected: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#c8c4bb",
  },
  tileSub: {
    fontSize: 12,
    color: "#7a7670",
    marginTop: 2,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.20)",
  },
  countryTile: {
    width: "47%",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7a7670",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  input: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f4f2ed",
    paddingVertical: 12,
  },
  inputAffix: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7a7670",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },
  chipSelected: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7a7670",
  },
});
