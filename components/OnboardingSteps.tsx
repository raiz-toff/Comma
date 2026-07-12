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
import { withAlpha } from "../src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { getPlatformsByCountry, PLATFORMS, PLATFORM_REGISTRY } from "../src/registry/platforms";
import { PlatformLogo } from "../src/components/GlobalTopHeader";
import { getRegionsByCountry } from "../src/registry/countries/index";
import { type FeatureKey } from "../src/registry/modules";
import { type FirstShiftMath } from "../src/services/onboarding/firstShift";
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
  CloudUpload,
} from "lucide-react-native";
import { GoogleDriveLogo } from "../src/components/logos/GoogleDriveLogo";

// ─── Shared primitives ────────────────────────────────────────────────────────

function StepHeading({ title, sub }: { title: string; sub?: string }) {
  const C = useColors();
  return (
    <View style={{ gap: 6, marginBottom: 28 }}>
      <Text variant="headingXl">{title}</Text>
      {sub && (
        <Text variant="paragraphM" style={{ color: C.contentMuted }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const C = useColors();
  return (
    <Text variant="labelXs" style={{ color: C.contentMuted }}>
      {label}
    </Text>
  );
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.inputRow}>
      {prefix && (
        <Text variant="headingS" style={{ color: C.contentMuted }}>
          {prefix}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.contentMuted}
        keyboardType={keyboardType}
        style={[s.input, { flex: 1 }]}
      />
      {suffix && (
        <Text variant="headingS" style={{ color: C.contentMuted }}>
          {suffix}
        </Text>
      )}
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
  const C = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.background,
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
            variant="labelXs"
            style={{ letterSpacing: 2.5, marginTop: 10 }}
          >
            COMMA
          </Text>
        </View>

        {/* Hero — the commas in the lead carry the brand color: Comma's namesake is
            the one decorative gesture on this screen. Mirrors the web landing. */}
        <View style={{ alignItems: "center", gap: 14 }}>
          <Text variant="headingXl" style={{ textAlign: "center" }}>
            Stop guessing{"\n"}what you made.
          </Text>
          <Text
            variant="paragraphL"
            style={{
              color: C.contentMuted,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            Comma logs every dollar
            <Text variant="paragraphL" style={{ color: C.primary }}>,</Text> every mile
            <Text variant="paragraphL" style={{ color: C.primary }}>,</Text> and every
            write-off — and shows you what a shift was really worth.
          </Text>
        </View>

        {/* CTAs — one real button; the side paths are quiet text links under it. */}
        <View style={{ gap: 6 }}>
          <Pressable
            onPress={onStart}
            disabled={demoLoading}
            accessibilityRole="button"
            accessibilityState={{ disabled: demoLoading }}
            style={{
              backgroundColor: demoLoading ? C.surface05 : C.contentPrimary,
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: "center",
            }}
          >
            <Text
              variant="headingS"
              style={{
                color: demoLoading ? C.contentMuted : C.background,
                letterSpacing: 0.2,
              }}
            >
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={demoLoading ? undefined : onDemo}
            accessibilityRole="button"
            accessibilityState={{ disabled: demoLoading }}
            style={{
              paddingVertical: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {demoLoading
              ? <>
                  <ActivityIndicator size="small" color={C.contentSecondary} />
                  <Text variant="labelM" style={{ color: C.contentSecondary }}>Setting up demo...</Text>
                </>
              : <Text variant="labelM" style={{ color: C.contentSecondary }}>Try with demo data</Text>
            }
          </Pressable>

          <Pressable
            onPress={demoLoading ? undefined : onRestoreSync}
            accessibilityRole="button"
            accessibilityState={{ disabled: demoLoading }}
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <Text variant="labelM" style={{ color: C.contentSecondary }}>Restore or sync existing data</Text>
          </Pressable>

          <Text
            variant="paragraphS"
            style={{ textAlign: "center", marginTop: 4 }}
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
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
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[s.countryTile, selected && s.tileSelected]}
            >
              <Text style={{ fontSize: 28 }}>{flag}</Text>
              <Text
                variant="labelL"
                style={[
                  s.tileTitle,
                  { textAlign: "center" },
                  selected && { color: C.contentPrimary },
                ]}
              >
                {label}
              </Text>
              <Text variant="paragraphS" style={[s.tileSub, { textAlign: "center" }]}>{sub}</Text>
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
  const C = useColors();
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
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          {regions.map((r) => {
            const selected = value === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => onChange(r.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: selected ? withAlpha(C.contentPrimary, 0.05) : C.surface02,
                  borderWidth: 1,
                  borderColor: selected ? C.contentPrimary : C.lineSubtle,
                }}
              >
                <Text
                  variant="labelM"
                  style={{
                    color: selected ? C.contentPrimary : C.contentSecondary,
                  }}
                >
                  {r.label}
                </Text>
                {selected && (
                  <Check size={14} color={C.contentPrimary} strokeWidth={2.5} />
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
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
                        backgroundColor: withAlpha(p.color, 0.12),
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
                    variant="labelL"
                    style={[s.tileTitle, selected && { color: C.contentPrimary }]}
                  >
                    {p.label}
                  </Text>
                </View>
                {selected && (
                  <Check size={14} color={C.contentPrimary} strokeWidth={2.5} />
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { getVehicleMileageEligibility } = require("../src/registry/countries/mileageRates");
  const mileageInfo = getVehicleMileageEligibility(country, type);

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.chip, selected && s.chipSelected]}
                >
                  <Icon
                    size={14}
                    color={selected ? C.contentPrimary : C.contentMuted}
                    strokeWidth={2}
                  />
                  <Text
                    variant="paragraphS"
                    style={selected && { color: C.contentPrimary }}
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
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.lineSubtle,
              borderRadius: 16,
              padding: 14,
              gap: 12,
            }}
          >
            <Text variant="paragraphS" style={{ color: C.contentSecondary }}>
              {mileageInfo.eligible
                ? `${mileageInfo.label} — $${mileageInfo.ratePrimary}/${type === "gas" || type === "hybrid" || type === "ev" ? "mi or km" : "unit"}`
                : mileageInfo.label}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text variant="labelM" style={{ flex: 1 }}>
                This doesn't apply to me
              </Text>
              <Switch
                value={mileageOptOut}
                onValueChange={setMileageOptOut}
                accessibilityLabel="This doesn't apply to me"
                trackColor={{ false: C.surface05, true: C.primary }}
                thumbColor={C.contentPrimary}
              />
            </View>

            {!mileageOptOut && (
              <View style={{ gap: 8 }}>
                <Text variant="paragraphS">
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
  const C = useColors();
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
              backgroundColor: C.surface04,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                backgroundColor: C.contentPrimary,
                borderRadius: 3,
                width: `${pct}%`,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>
              {currencySymbol}0
            </Text>
            <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>
              {currencySymbol}1,000
            </Text>
          </View>
        </View>

        {num > 0 && (
          <View
            style={{
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.lineSubtle,
              borderRadius: 16,
              padding: 16,
              gap: 4,
            }}
          >
            <Text variant="labelXs" style={{ color: C.contentMuted }}>
              That works out to
            </Text>
            <Text variant="headingM" tabular>
              {currencySymbol}
              {Math.round(num * 4.33).toLocaleString()} / month
            </Text>
            <Text variant="paragraphS" tabular>
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
  const C = useColors();
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
            backgroundColor: C.surface04,
            borderWidth: 1,
            borderColor: C.lineStrong,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <Navigation size={28} color={C.contentPrimary} strokeWidth={1.5} />
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
                  backgroundColor: C.surface04,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                <Check size={10} color={C.contentPrimary} strokeWidth={3} />
              </View>
              <Text variant="paragraphM" style={{ flex: 1 }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={handleRequest}
          accessibilityRole="button"
          style={{
            backgroundColor: C.contentPrimary,
            borderRadius: 16,
            paddingVertical: 17,
            alignItems: "center",
          }}
        >
          <Text variant="headingS" style={{ color: C.background }}>
            Enable GPS tracking
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          style={{ paddingVertical: 14, alignItems: "center" }}
        >
          <Text variant="labelM" style={{ color: C.contentMuted }}>
            Skip — I'll enter mileage manually
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step — Protect your data (Cloud Sync) ────────────────────────────────────

export function SyncStep({
  onConnect,
  onSkip,
  isConnecting,
  isConnected,
}: {
  onConnect: () => void;
  onSkip: () => void;
  isConnecting?: boolean;
  isConnected?: boolean;
}) {
  const C = useColors();
  return (
    <View style={{ flex: 1, justifyContent: "space-between" }}>
      <View>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: C.surface04,
            borderWidth: 1,
            borderColor: C.lineStrong,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <CloudUpload size={28} color={C.contentPrimary} strokeWidth={1.5} />
        </View>
        <StepHeading
          title="Protect your data"
          sub="Back up your shifts securely to Google Drive. Your data stays private and is only accessible with your Google Account."
        />
        <View style={{ gap: 12 }}>
          {[
            "One tap to set up — no passwords to remember",
            "Sync across devices automatically",
            "Your GPS tracking data always stays local on your phone",
            "You can always change this later in Settings → Cloud Sync",
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
                  backgroundColor: C.surface04,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                <Check size={10} color={C.contentPrimary} strokeWidth={3} />
              </View>
              <Text variant="paragraphM" style={{ flex: 1 }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {isConnected ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 16,
            }}
          >
            <Check size={18} color={C.contentPrimary} strokeWidth={3} />
            <Text variant="labelM">Google Drive connected!</Text>
          </View>
        ) : (
          <Pressable
            onPress={isConnecting ? undefined : onConnect}
            accessibilityRole="button"
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: C.contentPrimary,
                borderRadius: 16,
                paddingVertical: 16,
                opacity: isConnecting ? 0.6 : 1,
              },
            ]}
          >
            <GoogleDriveLogo size={18} />
            <Text variant="headingS" style={{ color: C.background }}>
              {isConnecting ? "Connecting…" : "Connect Google Drive"}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          style={{ paddingVertical: 14, alignItems: "center" }}
        >
          <Text variant="labelM" style={{ color: C.contentMuted, textAlign: "center" }}>
            Skip for now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 6 — Appearance ─────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { id: "#F6F6F7", label: "Default" }, // near-white — preserves the clean monochrome look
  { id: "#22c55e", label: "Emerald" },
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <StepHeading
        title="Make it yours"
        sub="Choose a theme and accent color. You can change these anytime in Settings."
      />

      <View style={{ gap: 24 }}>
        {/* Theme */}
        <View style={{ gap: 10 }}>
          <FieldLabel label="Theme" />
          <View style={{ gap: 8 }}>
            {THEME_OPTIONS.map(({ id, label, sub, Icon }) => {
              const selected = theme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTheme(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.tile, selected && s.tileSelected]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                    <View style={[s.iconBox, selected && s.iconBoxSelected]}>
                      <Icon size={18} color={selected ? C.contentPrimary : C.contentMuted} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="labelL" style={[s.tileTitle, selected && { color: C.contentPrimary }]}>{label}</Text>
                      <Text variant="paragraphS" style={s.tileSub}>{sub}</Text>
                    </View>
                  </View>
                  {selected && <Check size={14} color={C.contentPrimary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Accent color */}
        <View style={{ gap: 10 }}>
          <FieldLabel label="Accent colour" />
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={label}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: id,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected
                      ? (isLight ? C.contentMuted : C.contentPrimary)
                      : C.lineStrong,
                  }}
                >
                  {selected && (
                    <Check
                      size={16}
                      color={isLight ? C.background : C.contentPrimary}
                      strokeWidth={3}
                    />
                  )}
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
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <StepHeading
        title="Preferences"
        sub="Tune Comma to how you work. All of these can be changed later."
      />

      <View style={{ gap: 28 }}>
        {/* Week starts on */}
        <View style={{ gap: 10 }}>
          <FieldLabel label="Week starts on" />
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.chip, selected && s.chipSelected, { flex: 1, justifyContent: "center" }]}
                >
                  <Text
                    variant="paragraphS"
                    style={[
                      selected && { color: C.contentPrimary },
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
          <FieldLabel label="Time format" />
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
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.tile, selected && s.tileSelected, { flex: 1, flexDirection: "column", alignItems: "flex-start", gap: 4 }]}
                >
                  <Text variant="labelL" style={[s.tileTitle, selected && { color: C.contentPrimary }]}>{label}</Text>
                  <Text variant="paragraphS" style={s.tileSub}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Optional features */}
        <View style={{ gap: 10 }}>
          <FieldLabel label="Optional features" />
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
                    backgroundColor: C.card,
                    borderWidth: 1,
                    borderColor: C.lineSubtle,
                    borderRadius: 12,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM" style={{ color: C.contentSecondary }}>
                      {label}
                    </Text>
                    <Text variant="paragraphS" style={{ marginTop: 2 }}>
                      {description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleFeature(key)}
                    accessibilityLabel={label}
                    trackColor={{ false: C.surface05, true: C.primary }}
                    thumbColor={C.contentPrimary}
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
  const C = useColors();
  const insets = useSafeAreaInsets();
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";
  const accentLight = isLightHex(accentColor);
  const onAccent = accentLight ? C.background : C.contentPrimary;

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
        backgroundColor: C.background,
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
                backgroundColor: withAlpha(accentColor, 0.08),
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
              style={{ color: C.contentPrimary, textAlign: "center", lineHeight: 46 }}
            >
              {displayName ? `Let's roll,\n${displayName}.` : "Let's roll."}
            </Text>
            <Text
              variant="paragraphM"
              style={{ color: C.contentSecondary, textAlign: "center", maxWidth: 300, marginTop: 2 }}
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
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.lineSubtle,
              borderRadius: 20,
              paddingVertical: 22,
              paddingHorizontal: 20,
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text variant="labelXs" style={{ color: C.contentMuted, letterSpacing: 1.5 }}>
              YOUR WEEKLY TARGET
            </Text>
            <Text variant="display" tabular>
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
                        backgroundColor: withAlpha(p?.color ?? C.surface05, 0.12),
                        borderWidth: 1,
                        borderColor: withAlpha(p?.color ?? C.surface05, 0.25),
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
                            backgroundColor: p?.color ?? C.contentSecondary,
                          }}
                        />
                      )}
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: C.contentPrimary,
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
            accessibilityRole="button"
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
            <Text variant="headingS" style={{ color: onAccent }}>
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

const makeStyles = (C: Palette) => StyleSheet.create({
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
  tileSelected: {
    borderColor: C.contentPrimary,
    backgroundColor: C.surface04,
  },
  // Sizes/weights come from Text variants (labelL / paragraphS) — these only carry
  // the base color / spacing.
  tileTitle: {
    color: C.contentSecondary,
  },
  tileSub: {
    marginTop: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: C.surface04,
    borderColor: C.lineStrong,
  },
  countryTile: {
    width: "47%",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  input: {
    fontSize: 16,
    fontWeight: "600",
    color: C.contentPrimary,
    paddingVertical: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.lineSubtle,
  },
  chipSelected: {
    borderColor: C.contentPrimary,
    backgroundColor: C.surface04,
  },
});

// ─── Activation flow ──────────────────────────────────────────────────────────
// The three screens between install and the driver's first real number. Everything else the
// app needs is either derived, defaulted, or deferred to the dashboard checklist.

/** Country and region on one screen — region reveals itself once a country is picked. */
export function CountryRegionStep({
  country,
  onCountryChange,
  taxRegion,
  onRegionChange,
}: {
  country: "US" | "CA" | "UK" | "NP";
  onCountryChange: (c: "US" | "CA" | "UK" | "NP") => void;
  taxRegion: string;
  onRegionChange: (r: string) => void;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const regions = getRegionsByCountry(country);
  // NP has a single tax regime — asking for a region would be a step that changes nothing.
  const needsRegion = country !== "NP" && regions.length > 1;
  const regionLabel =
    country === "CA" ? "Province" : country === "US" ? "State" : "Region";

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="Where do you drive?"
        sub="Sets your currency, distance unit, tax rate, and mileage write-off."
      />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {COUNTRIES.map(({ code, flag, label, sub }) => {
            const selected = country === code;
            return (
              <Pressable
                key={code}
                onPress={() => onCountryChange(code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[s.countryTile, selected && s.tileSelected]}
              >
                <Text style={{ fontSize: 28 }}>{flag}</Text>
                <Text
                  variant="labelL"
                  style={[
                    s.tileTitle,
                    { textAlign: "center" },
                    selected && { color: C.contentPrimary },
                  ]}
                >
                  {label}
                </Text>
                <Text variant="paragraphS" style={[s.tileSub, { textAlign: "center" }]}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {needsRegion && (
          <View style={{ marginTop: 26, gap: 8 }}>
            <FieldLabel label={regionLabel.toUpperCase()} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {regions.map((r) => {
                const selected = taxRegion === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onRegionChange(r.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[s.chip, selected && s.chipSelected]}
                  >
                    <Text
                      variant="labelM"
                      style={{
                        color: selected ? C.contentPrimary : C.contentSecondary,
                      }}
                    >
                      {r.id}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The backfill step. Four fields, and the whole flow turns on them — this is the only screen
 * that produces data rather than configuration. A driver who hasn't worked yet escapes via
 * onSkip and gets the same activation job done by the dashboard's empty state instead.
 */
export function LastShiftStep({
  country,
  platform,
  onPlatformChange,
  hours,
  onHoursChange,
  gross,
  onGrossChange,
  distance,
  onDistanceChange,
  currencySymbol,
  distanceUnit,
  onSkip,
}: {
  country: string;
  platform: string;
  onPlatformChange: (id: string) => void;
  hours: string;
  onHoursChange: (v: string) => void;
  gross: string;
  onGrossChange: (v: string) => void;
  distance: string;
  onDistanceChange: (v: string) => void;
  currencySymbol: string;
  distanceUnit: string;
  onSkip: () => void;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const platforms = getPlatformsByCountry(country);

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="Your last shift"
        sub="Roughly is fine. We'll show you what it was actually worth."
      />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8, marginBottom: 22 }}>
          <FieldLabel label="WHICH APP?" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {platforms.map((p) => {
              const selected = platform === p.id;
              const hasLogo = !!PLATFORM_REGISTRY[p.id]?.logo;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onPlatformChange(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.chip, selected && s.chipSelected]}
                >
                  {hasLogo ? (
                    <PlatformLogo id={p.id} size={16} />
                  ) : (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: p.color,
                      }}
                    />
                  )}
                  <Text
                    variant="labelM"
                    style={{
                      color: selected ? C.contentPrimary : C.contentSecondary,
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 18 }}>
          <View style={{ gap: 8 }}>
            <FieldLabel label="HOW LONG WERE YOU OUT?" />
            <StyledInput
              value={hours}
              onChangeText={onHoursChange}
              placeholder="5"
              keyboardType="decimal-pad"
              suffix="hours"
            />
          </View>

          <View style={{ gap: 8 }}>
            <FieldLabel label="WHAT DID YOU MAKE? (TIPS INCLUDED)" />
            <StyledInput
              value={gross}
              onChangeText={onGrossChange}
              placeholder="142"
              keyboardType="decimal-pad"
              prefix={currencySymbol}
            />
          </View>

          <View style={{ gap: 8 }}>
            <FieldLabel label={`HOW FAR DID YOU DRIVE? (OPTIONAL)`} />
            <StyledInput
              value={distance}
              onChangeText={onDistanceChange}
              placeholder="47"
              keyboardType="decimal-pad"
              suffix={distanceUnit}
            />
            <Text variant="paragraphS" style={{ color: C.contentMuted }}>
              Turns into a tax write-off. Skip it and we'll just leave it out.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          style={{ alignItems: "center", paddingVertical: 18, marginTop: 8 }}
        >
          <Text variant="labelM" style={{ color: C.contentMuted }}>
            I haven't driven yet
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * The activation moment. Sequences three numbers the app already computes into the one
 * realisation gig drivers never get from the platforms themselves: gross is not take-home.
 */
export function FirstShiftReveal({
  math,
  accentColor = "#F6F6F7",
  onEnter,
}: {
  math: FirstShiftMath;
  accentColor?: string;
  onEnter: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const accentLight = isLightHex(accentColor);
  const onAccent = accentLight ? C.background : C.contentPrimary;
  const cur = math.currencySymbol;

  const money = (n: number) =>
    `${cur}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Count the real hourly rate up from the gross one — the gap between the two IS the insight,
  // so we animate across it rather than just landing on a number.
  const [shown, setShown] = useState(math.grossHourly);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const begin = 900;
    const dur = 1200;
    const from = math.grossHourly;
    const to = math.realHourly;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start - begin) / dur));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [math.grossHourly, math.realHourly]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 24 }}>
          <Rise delay={0} style={{ gap: 8 }}>
            <Text variant="labelXs" style={{ color: accentColor, letterSpacing: 2 }}>
              YOUR LAST SHIFT
            </Text>
            <Text variant="paragraphM" style={{ color: C.contentSecondary }}>
              You made {money(math.gross)} over {math.hours} hours. The app told you that was{" "}
              <Text variant="labelL" style={{ color: C.contentPrimary }}>
                {money(math.grossHourly)}/hr
              </Text>
              .
            </Text>
          </Rise>

          {/* The hero: real hourly, counted down from the gross figure. */}
          <Rise delay={420}>
            <View
              style={{
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: withAlpha(accentColor, 0.35),
                borderRadius: 24,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text variant="labelXs" style={{ color: C.contentMuted, letterSpacing: 1.5 }}>
                WHAT YOU ACTUALLY KEEP
              </Text>
              <Text variant="display" tabular style={{ color: accentColor }}>
                {money(shown)}
                <Text variant="headingM" style={{ color: C.contentMuted }}>
                  /hr
                </Text>
              </Text>
              <Text
                variant="paragraphS"
                style={{ color: C.contentSecondary, textAlign: "center", marginTop: 2 }}
              >
                {money(math.takeHome)} take-home, after {money(math.taxSetAside)} set aside for tax
              </Text>
            </View>
          </Rise>

          {/* The receipt — every line traceable to a screen they can go check. */}
          <Rise delay={700} style={{ gap: 10 }}>
            <RevealRow label="You earned" value={money(math.gross)} />
            <RevealRow
              label={`Tax to set aside (${math.withholdingPct}%)`}
              value={`− ${money(math.taxSetAside)}`}
            />
            <View style={{ height: 1, backgroundColor: C.lineSubtle, marginVertical: 2 }} />
            <RevealRow label="Yours to keep" value={money(math.takeHome)} strong />

            {math.hasMileageDeduction && math.mileageWriteOff > 0 && (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: withAlpha(accentColor, 0.07),
                  borderWidth: 1,
                  borderColor: withAlpha(accentColor, 0.2),
                  borderRadius: 14,
                  padding: 14,
                  gap: 3,
                }}
              >
                <Text variant="labelM" style={{ color: C.contentPrimary }}>
                  + {money(math.mileageWriteOff)} in write-offs
                </Text>
                <Text variant="paragraphS" style={{ color: C.contentSecondary }}>
                  Those {math.distance} {math.distanceUnit} are deductible at {math.mileageRateLabel}.
                  Assumes a gas car — set your real vehicle to sharpen this.
                </Text>
              </View>
            )}
          </Rise>
        </View>

        <Rise delay={980} style={{ marginTop: 28, gap: 12 }}>
          <Pressable
            onPress={onEnter}
            accessibilityRole="button"
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
            <Text variant="headingS" style={{ color: onAccent }}>
              Go to my dashboard
            </Text>
            <ArrowRight size={18} color={onAccent} strokeWidth={2.8} />
          </Pressable>
          <Text
            variant="paragraphS"
            style={{ color: C.contentMuted, textAlign: "center" }}
          >
            That shift is saved. Everything else can wait.
          </Text>
        </Rise>
      </ScrollView>
    </View>
  );
}

function RevealRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const C = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text
        variant={strong ? "labelL" : "paragraphM"}
        style={{ color: strong ? C.contentPrimary : C.contentSecondary }}
      >
        {label}
      </Text>
      <Text
        variant={strong ? "labelL" : "paragraphM"}
        tabular
        style={{ color: strong ? C.contentPrimary : C.contentSecondary }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Shown instead of the reveal when the driver hasn't worked yet. Same destination, different
 * promise — the dashboard's empty state picks the activation job up from here.
 */
export function NoShiftYetStep({
  accentColor = "#F6F6F7",
  onEnter,
}: {
  accentColor?: string;
  onEnter: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const onAccent = isLightHex(accentColor) ? C.background : C.contentPrimary;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: 24,
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <Rise delay={0} style={{ gap: 12 }}>
          <Text variant="labelXs" style={{ color: accentColor, letterSpacing: 2 }}>
            YOU'RE SET UP
          </Text>
          <Text variant="display" style={{ color: C.contentPrimary, lineHeight: 46 }}>
            Go drive.
          </Text>
          <Text variant="paragraphM" style={{ color: C.contentSecondary, maxWidth: 320 }}>
            When you get back, log the shift — or hit the tracker before you set off — and Comma
            will show you what it was really worth after tax and mileage.
          </Text>
        </Rise>
      </View>

      <Rise delay={320} style={{ paddingBottom: 28 }}>
        <Pressable
          onPress={onEnter}
          accessibilityRole="button"
          style={{
            backgroundColor: accentColor,
            borderRadius: 16,
            paddingVertical: 17,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text variant="headingS" style={{ color: onAccent }}>
            Go to my dashboard
          </Text>
          <ArrowRight size={18} color={onAccent} strokeWidth={2.8} />
        </Pressable>
      </Rise>
    </View>
  );
}
