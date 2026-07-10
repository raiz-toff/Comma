import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Text } from "../src/components/ui/text";
import { getPlatformsByCountry, PLATFORMS, PLATFORM_REGISTRY } from "../src/registry/platforms";
import { PlatformLogo } from "../src/components/GlobalTopHeader";
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
  ArrowRight,
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
  keyboardType?: "default" | "numeric" | "decimal-pad";
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
        placeholderTextColor="#65656E"
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
  onRestoreSync,
  demoLoading = false,
}: {
  onStart: () => void;
  onDemo: () => void;
  onRestoreSync: () => void;
  demoLoading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
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
          <Image
            source={require("../assets/logo-mascot.png")}
            style={{ width: 110, height: 110 }}
            contentFit="contain"
          />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#F6F6F7",
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginTop: 10,
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
              color: "#F6F6F7",
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
              color: "#65656E",
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
            disabled={demoLoading}
            style={{
              backgroundColor: demoLoading ? "#333" : "#F6F6F7",
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: demoLoading ? "#65656E" : "#000",
                letterSpacing: 0.2,
              }}
            >
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={demoLoading ? undefined : onDemo}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "#0F0F12",
              borderWidth: 1,
              borderColor: "#1E1E23",
            }}
          >
            {demoLoading
              ? <>
                  <ActivityIndicator size="small" color="#9B9BA4" />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#9B9BA4" }}>Setting up demo...</Text>
                </>
              : <Text style={{ fontSize: 14, fontWeight: "600", color: "#9B9BA4" }}>Try with demo data</Text>
            }
          </Pressable>

          <Pressable
            onPress={demoLoading ? undefined : onRestoreSync}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              backgroundColor: "#0F0F12",
              borderWidth: 1,
              borderColor: "#1E1E23",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#9B9BA4" }}>Restore / Sync existing data</Text>
          </Pressable>

          <Text
            style={{
              fontSize: 11,
              color: "#65656E",
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
                  selected && { color: "#F6F6F7" },
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
                    : "#0F0F12",
                  borderWidth: 1,
                  borderColor: selected ? "#F6F6F7" : "#1E1E23",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: selected ? "#F6F6F7" : "#9B9BA4",
                  }}
                >
                  {r.label}
                </Text>
                {selected && (
                  <Check size={14} color="#F6F6F7" strokeWidth={2.5} />
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
            const hasLogo = !!PLATFORM_REGISTRY[p.id]?.logo;
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
                  {hasLogo ? (
                    // Brand logo when one exists — chip tinted with the platform color.
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: p.color + "1f",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PlatformLogo id={p.id} size={18} />
                    </View>
                  ) : (
                    // Fallback: the platform's brand color as a dot.
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: p.color,
                      }}
                    />
                  )}
                  <Text
                    style={[s.tileTitle, selected && { color: "#F6F6F7" }]}
                  >
                    {p.label}
                  </Text>
                </View>
                {selected && (
                  <Check size={14} color="#F6F6F7" strokeWidth={2.5} />
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
  country,
  mileageOptOut,
  setMileageOptOut,
  mileageRateOverride,
  setMileageRateOverride,
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
  country: string;
  mileageOptOut: boolean;
  setMileageOptOut: (v: boolean) => void;
  mileageRateOverride: string;
  setMileageRateOverride: (v: string) => void;
}) {
  const { getVehicleMileageEligibility } = require("../src/registry/countries/mileageRates");
  const mileageInfo = getVehicleMileageEligibility(country, type);

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
                    color={selected ? "#F6F6F7" : "#65656E"}
                    strokeWidth={2}
                  />
                  <Text
                    style={[s.chipText, selected && { color: "#F6F6F7" }]}
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

        <View style={{ gap: 10 }}>
          <FieldLabel label="Mileage write-off" />
          <View
            style={{
              backgroundColor: "#0F0F12",
              borderWidth: 1,
              borderColor: "#1E1E23",
              borderRadius: 14,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: "#9B9BA4", lineHeight: 17 }}>
              {mileageInfo.eligible
                ? `${mileageInfo.label} — $${mileageInfo.ratePrimary}/${type === "gas" || type === "hybrid" || type === "ev" ? "mi or km" : "unit"}`
                : mileageInfo.label}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#F6F6F7", flex: 1 }}>
                This doesn't apply to me
              </Text>
              <Switch
                value={mileageOptOut}
                onValueChange={setMileageOptOut}
                trackColor={{ false: "#26262C", true: "#10b981" }}
                thumbColor="#F6F6F7"
              />
            </View>

            {!mileageOptOut && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, color: "#65656E" }}>
                  Know your actual rate differs? Set it here — otherwise we'll use the default above.
                </Text>
                <StyledInput
                  value={mileageRateOverride}
                  onChangeText={setMileageRateOverride}
                  placeholder={mileageInfo.ratePrimary != null ? String(mileageInfo.ratePrimary) : "e.g. 0.67"}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
          </View>
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
              backgroundColor: "#1C1C21",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                backgroundColor: "#F6F6F7",
                borderRadius: 3,
                width: `${pct}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10, color: "#65656E", fontWeight: "600" }}>
              {currencySymbol}0
            </Text>
            <Text style={{ fontSize: 10, color: "#65656E", fontWeight: "600" }}>
              {currencySymbol}1,000
            </Text>
          </View>
        </View>

        {num > 0 && (
          <View
            style={{
              backgroundColor: "#0F0F12",
              borderWidth: 1,
              borderColor: "#1E1E23",
              borderRadius: 14,
              padding: 16,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: "#65656E",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              That works out to
            </Text>
            <Text
              style={{ fontSize: 20, fontWeight: "800", color: "#F6F6F7" }}
            >
              {currencySymbol}
              {Math.round(num * 4.33).toLocaleString()} / month
            </Text>
            <Text style={{ fontSize: 13, color: "#65656E" }}>
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
          <Navigation size={28} color="#F6F6F7" strokeWidth={1.5} />
        </View>
        <StepHeading
          title="Automatic mileage tracking"
          sub="During an active shift, Comma records your GPS location in the background — even while the app is closed or you're using another app — so mileage keeps logging without you having to keep Comma open."
        />
        <View style={{ gap: 12 }}>
          {[
            "Active delivery miles separated from dead miles automatically",
            "Location is tracked in the background only while a shift is running, and stops the moment you end it",
            "You'll see a second prompt asking to allow location \"All the time\" — this is what lets tracking continue when Comma isn't on screen",
            "All location data stays 100% on your device — never uploaded anywhere",
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
                <Check size={10} color="#F6F6F7" strokeWidth={3} />
              </View>
              <Text
                style={{ fontSize: 14, color: "#9B9BA4", flex: 1, lineHeight: 20 }}
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
            backgroundColor: "#F6F6F7",
            borderRadius: 16,
            paddingVertical: 17,
            alignItems: "center",
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: "800", color: "#000" }}
          >
            Enable GPS tracking
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          style={{ paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#65656E" }}>
            Skip — I'll enter mileage manually
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 6 — Appearance ─────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { id: "#F6F6F7", label: "Default" }, // near-white — preserves the clean monochrome look
  { id: "#10b981", label: "Emerald" },
  { id: "#3b82f6", label: "Blue" },
  { id: "#f59e0b", label: "Amber" },
  { id: "#FF5247", label: "Rose" },
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
                      <Icon size={18} color={selected ? "#F6F6F7" : "#65656E"} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.tileTitle, selected && { color: "#F6F6F7" }]}>{label}</Text>
                      <Text style={s.tileSub}>{sub}</Text>
                    </View>
                  </View>
                  {selected && <Check size={14} color="#F6F6F7" strokeWidth={2.5} />}
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
              // Light swatches (e.g. the near-white default) need a dark check + a
              // hairline ring so they read against the dark background.
              const isLight = id === "#F6F6F7";
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
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected ? (isLight ? "#65656E" : "#F6F6F7") : "#2E2E36",
                  }}
                  accessibilityLabel={label}
                >
                  {selected && <Check size={16} color={isLight ? "#000" : "#F6F6F7"} strokeWidth={3} />}
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
                      selected && { color: "#F6F6F7" },
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
                  <Text style={[s.tileTitle, selected && { color: "#F6F6F7" }]}>{label}</Text>
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
                    backgroundColor: "#0F0F12",
                    borderWidth: 1,
                    borderColor: "#1E1E23",
                    borderRadius: 14,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#9B9BA4" }}>
                      {label}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#65656E", marginTop: 2, lineHeight: 16 }}>
                      {description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleFeature(key)}
                    trackColor={{ false: "#26262C", true: "#10b981" }}
                    thumbColor="#F6F6F7"
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

/** True when a hex color is light enough to need dark text on top. */
function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance (sRGB-ish).
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** One expanding/fading pulse ring radiating from the medallion. */
function PulseRing({ color, delay, size }: { color: string; delay: number; size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** A value that fades + slides up into place, staggered by `delay`. */
function Rise({
  delay,
  children,
  style,
}: {
  delay: number;
  children: React.ReactNode;
  style?: any;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [18, 0]) }],
  }));
  return <Animated.View style={[aStyle, style]}>{children}</Animated.View>;
}

export function RevealStep({
  displayName,
  selectedPlatforms,
  country,
  weeklyGoal,
  accentColor = "#F6F6F7",
  onEnter,
}: {
  displayName: string;
  selectedPlatforms: string[];
  country: string;
  weeklyGoal: string;
  accentColor?: string;
  onEnter: () => void;
}) {
  const insets = useSafeAreaInsets();
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";
  const accentLight = isLightHex(accentColor);
  const onAccent = accentLight ? "#000" : "#F6F6F7";

  // Goal count-up — drives the big north-star number.
  const goalTarget = Number(weeklyGoal) || 0;
  const [goalShown, setGoalShown] = useState(0);
  useEffect(() => {
    if (goalTarget <= 0) return;
    let raf = 0;
    const start = Date.now();
    const dur = 1100;
    const begin = 700; // start after the medallion lands
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start - begin) / dur));
      const eased = 1 - Math.pow(1 - t, 3);
      setGoalShown(Math.round(goalTarget * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [goalTarget]);

  // Medallion entrance (scale + settle).
  const medScale = useSharedValue(0.5);
  const medOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  useEffect(() => {
    medOpacity.value = withTiming(1, { duration: 500 });
    medScale.value = withSequence(
      withTiming(1.08, { duration: 460, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 220 })
    );
    checkScale.value = withDelay(380, withTiming(1, { duration: 380, easing: Easing.out(Easing.back(3)) }));
  }, []);
  const medStyle = useAnimatedStyle(() => ({
    opacity: medOpacity.value,
    transform: [{ scale: medScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const platforms = selectedPlatforms.slice(0, 5);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 28,
        }}
      >
        {/* ── Hero: pulsing aura + medallion ── */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
          <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
            {/* Radiating accent pulse rings */}
            <PulseRing color={accentColor} delay={0} size={200} />
            <PulseRing color={accentColor} delay={650} size={200} />
            <PulseRing color={accentColor} delay={1300} size={200} />

            {/* Soft accent glow disc */}
            <View
              style={{
                position: "absolute",
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: accentColor + "14",
              }}
            />

            {/* Medallion */}
            <Animated.View
              style={[
                {
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  backgroundColor: accentColor,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: accentColor,
                  shadowOpacity: 0.5,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 0 },
                },
                medStyle,
              ]}
            >
              <Animated.View style={checkStyle}>
                <Check size={48} color={onAccent} strokeWidth={3} />
              </Animated.View>
            </Animated.View>
          </View>

          {/* Headline + sub */}
          <Rise delay={520} style={{ alignItems: "center", gap: 10, paddingHorizontal: 8 }}>
            <Text
              variant="labelXs"
              style={{ color: accentColor, letterSpacing: 2 }}
            >
              YOU'RE ALL SET
            </Text>
            <Text
              variant="display"
              style={{ color: "#F6F6F7", textAlign: "center", lineHeight: 46 }}
            >
              {displayName ? `Let's roll,\n${displayName}.` : "Let's roll."}
            </Text>
            <Text
              variant="paragraphM"
              style={{ color: "#9B9BA4", textAlign: "center", maxWidth: 300, marginTop: 2 }}
            >
              Your private earnings tracker is ready. Start a shift and watch the numbers come alive.
            </Text>
          </Rise>
        </View>

        {/* ── North-star goal + platforms ── */}
        <Rise delay={760} style={{ gap: 14 }}>
          {/* Weekly goal — the count-up hero stat */}
          <View
            style={{
              backgroundColor: "#0F0F12",
              borderWidth: 1,
              borderColor: "#1E1E23",
              borderRadius: 20,
              paddingVertical: 22,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text variant="labelXs" style={{ color: "#65656E", letterSpacing: 1.5 }}>
              YOUR WEEKLY TARGET
            </Text>
            <Text
              tabular
              style={{
                fontSize: 44,
                lineHeight: 50,
                fontWeight: "800",
                color: "#F6F6F7",
                letterSpacing: -1,
              }}
            >
              {currencySymbol}
              {goalShown.toLocaleString()}
            </Text>

            {platforms.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {platforms.map((pid) => {
                  const p = PLATFORMS[pid as keyof typeof PLATFORMS];
                  const hasLogo = !!PLATFORM_REGISTRY[pid]?.logo;
                  return (
                    <View
                      key={pid}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: (p?.color ?? "#26262C") + "1f",
                        borderWidth: 1,
                        borderColor: (p?.color ?? "#26262C") + "40",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      {hasLogo ? (
                        <PlatformLogo id={pid} size={14} />
                      ) : (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: p?.color ?? "#9B9BA4",
                          }}
                        />
                      )}
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#F6F6F7",
                        }}
                      >
                        {p?.label ?? pid}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </Rise>

        {/* ── CTA ── */}
        <Rise delay={980}>
          <Pressable
            onPress={onEnter}
            style={{
              backgroundColor: accentColor,
              borderRadius: 16,
              paddingVertical: 17,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              shadowColor: accentColor,
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: onAccent }}>
              Go to my dashboard
            </Text>
            <ArrowRight size={18} color={onAccent} strokeWidth={2.8} />
          </Pressable>
        </Rise>
      </View>
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F6F6F7",
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  sub: {
    fontSize: 14,
    color: "#65656E",
    lineHeight: 20,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F0F12",
    borderWidth: 1,
    borderColor: "#1E1E23",
    borderRadius: 16,
    padding: 16,
  },
  tileSelected: {
    borderColor: "#F6F6F7",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  tileSub: {
    fontSize: 12,
    color: "#65656E",
    marginTop: 2,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F6F6F7",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0F0F12",
    borderWidth: 1,
    borderColor: "#1E1E23",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.20)",
  },
  countryTile: {
    width: "47%",
    backgroundColor: "#0F0F12",
    borderWidth: 1,
    borderColor: "#1E1E23",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#65656E",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F0F12",
    borderWidth: 1,
    borderColor: "#1E1E23",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  input: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F6F6F7",
    paddingVertical: 12,
  },
  inputAffix: {
    fontSize: 16,
    fontWeight: "700",
    color: "#65656E",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0F0F12",
    borderWidth: 1,
    borderColor: "#1E1E23",
  },
  chipSelected: {
    borderColor: "#F6F6F7",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#65656E",
  },
});
