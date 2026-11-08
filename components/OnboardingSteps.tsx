import React, { useState, useEffect } from "react";
import {
View,
ScrollView,
TextInput,
Pressable, StyleSheet,
ActivityIndicator
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
useSharedValue,
useAnimatedStyle,
withTiming,
withDelay, Easing,
interpolate
} from "react-native-reanimated";
import { Text } from "../src/components/ui/text";
import { withAlpha } from "../src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { getPlatformsByCountry, PLATFORM_REGISTRY } from "../src/registry/platforms";
import { PlatformLogo } from "../src/components/GlobalTopHeader";
import { getRegionsByCountry } from "../src/registry/countries/index";
import { type FirstShiftMath } from "../src/services/onboarding/firstShift";
import {
ArrowRight
} from "lucide-react-native";

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

        {/* CTAs — a clear ladder: commit (filled) → explore (outlined) → return (quiet link,
            set apart by a divider). Mirrors the web landing's three-tier hierarchy. */}
        <View style={{ gap: 10 }}>
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

          {/* Explore path — a real outlined button, one rung below the filled primary, so it
              reads as an option rather than a throwaway text link. */}
          <Pressable
            onPress={demoLoading ? undefined : onDemo}
            accessibilityRole="button"
            accessibilityState={{ disabled: demoLoading }}
            style={{
              borderWidth: 1,
              borderColor: C.lineStrong,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {demoLoading
              ? <>
                  <ActivityIndicator size="small" color={C.contentSecondary} />
                  <Text variant="labelL" style={{ color: C.contentSecondary }}>Setting up demo...</Text>
                </>
              : <Text variant="labelL" style={{ color: C.contentPrimary }}>Try with demo data</Text>
            }
          </Pressable>

          {/* Returning-user path, set apart by a hairline so it doesn't compete with the two
              first-run actions above it. */}
          <View style={{ height: 1, backgroundColor: C.lineSubtle, marginTop: 4 }} />

          <Pressable
            onPress={demoLoading ? undefined : onRestoreSync}
            accessibilityRole="button"
            accessibilityState={{ disabled: demoLoading }}
            style={{ paddingVertical: 10, alignItems: "center" }}
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

// ─── Countries ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "CA" as const, flag: "🇨🇦", label: "Canada", sub: "CAD · km" },
  // { code: "US" as const, flag: "🇺🇸", label: "United States", sub: "USD · miles" },
  // { code: "UK" as const, flag: "🇬🇧", label: "United Kingdom", sub: "GBP · miles" },
  // { code: "NP" as const, flag: "🇳🇵", label: "Nepal", sub: "NPR · km" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
