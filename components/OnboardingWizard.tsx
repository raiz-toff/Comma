import React, { useState } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FileDown } from "lucide-react-native";
import { Text } from "../src/components/ui/text";
import { COLORS } from "../src/theme/colors";
import { useSettingsStore, type DriverProfile, type VehicleDraft } from "../store/useSettingsStore";
import { getCountryDef } from "../src/registry/countries/index";
import { type FeatureKey } from "../src/registry/modules";
import { restoreBackupFile } from "../src/services/backupFile";
import { GoogleDriveLogo } from "../src/components/logos/GoogleDriveLogo";
import {
  WelcomeScreen,
  CountryRegionStep,
  LastShiftStep,
  FirstShiftReveal,
  NoShiftYetStep,
} from "./OnboardingSteps";
import {
  computeFirstShift,
  ASSUMED_VEHICLE_TYPE,
  type FirstShiftMath,
} from "../src/services/onboarding/firstShift";
import { insertShift } from "../src/database/queries/shifts";
import { getVehicles } from "../src/database/queries/vehicles";

/**
 * Onboarding exists to do exactly one thing: get a driver to their first real number.
 *
 * Two questions stand between install and that number — where they drive (which fixes currency,
 * distance unit, tax rate and mileage rate) and what their last shift looked like. Everything the
 * app used to ask here (name, vehicle, goals, theme, week-start, time format, feature toggles,
 * GPS, Drive sync) is either derived, defaulted, or deferred to the dashboard checklist, because
 * none of it is an input to the number and all of it was sitting in front of the value.
 */

const STEP_LOCATION = 0;
const STEP_LAST_SHIFT = 1;
const TOTAL_STEPS = 2;

// Default all user-toggleable features to on
const DEFAULT_FEATURES: Partial<Record<FeatureKey, boolean>> = {
  analytics_advanced: true,
  tax_workspace: true,
  goals: true,
  schedule: false,
  pdf_reports: true,
};

/** Kept in step with the reveal's assumption so the write-off it promised stays true afterwards. */
const DEFAULT_VEHICLE: VehicleDraft = {
  nickname: "My Car",
  type: ASSUMED_VEHICLE_TYPE,
  make: "",
  model: "",
  year: "",
};

const DEFAULT_WEEKLY_GOAL = 500;

export default function OnboardingWizard() {
  const { completeOnboarding, updateFeatureOverride, loadSampleData, loadSettings, isLoading } =
    useSettingsStore();
  const insets = useSafeAreaInsets();

  const [showWelcome, setShowWelcome] = useState(true);
  const [stepIndex, setStepIndex] = useState(STEP_LOCATION);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Reveal — set once the driver has given us a shift (or told us they have none yet).
  const [revealMath, setRevealMath] = useState<FirstShiftMath | null>(null);
  const [showNoShiftYet, setShowNoShiftYet] = useState(false);

  // "Restore / Sync existing data" (welcome screen third option)
  const [showRestoreChooser, setShowRestoreChooser] = useState(false);
  const [isRestoringFile, setIsRestoringFile] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  // Where they drive
  const [country, setCountry] = useState<"US" | "CA" | "UK" | "NP">("CA");
  const [taxRegion, setTaxRegion] = useState("ON");

  // Their last shift
  const [platform, setPlatform] = useState("");
  const [hours, setHours] = useState("");
  const [gross, setGross] = useState("");
  const [distance, setDistance] = useState("");
  const [shiftError, setShiftError] = useState("");

  const countryDef = getCountryDef(country);

  const buildProfile = (): DriverProfile => ({
    // Not asked any more — the checklist offers a name, a goal, and the rest of their apps once
    // they're already inside and can see why it matters.
    displayName: "Driver",
    country,
    taxRegion,
    operationalModelId: "delivery_fixed",
    avatarType: "emoji",
    avatarData: "#F6F6F7",
    selectedPlatforms: platform ? [platform] : [],
    workSchedulePreset: "flexible",
    weeklyGoal: DEFAULT_WEEKLY_GOAL,
    monthlyGoal: Math.round(DEFAULT_WEEKLY_GOAL * 4.33),
    annualGoal: DEFAULT_WEEKLY_GOAL * 52,
    taxWithholdingPct: countryDef.tax.defaultWithholdingPct,
    hstRegistered: false,
    distanceUnit: countryDef.distanceUnit,
    theme: "dark",
    accentColor: "#F6F6F7",
    locale: { weekStartDay: 1, timeFormat: "12h" },
  });

  /** Writes the profile, the assumed vehicle, and the feature defaults. */
  const persistSetup = async () => {
    await completeOnboarding(buildProfile(), DEFAULT_VEHICLE, null, true);
    for (const [key, val] of Object.entries(DEFAULT_FEATURES)) {
      await updateFeatureOverride(key as FeatureKey, val as boolean);
    }
  };

  /**
   * Saves the backfilled shift.
   *
   * Anchored to *now* rather than to a guessed past date, deliberately: the dashboard reports on
   * the current week, so a shift dated to "yesterday" silently falls outside it whenever today is
   * the first day of the week — and the driver would land on a wall of zeros seconds after being
   * shown their hourly rate. Being a few hours off on a timestamp they can edit is a much smaller
   * cost than breaking the moment the whole flow is built around.
   */
  const persistFirstShift = async (math: FirstShiftMath) => {
    const vehicles = await getVehicles();
    const vehicleId = vehicles.find((v) => v.isActive)?.id ?? vehicles[0]?.id ?? null;

    const endTime = Date.now();
    const durationSeconds = Math.round(math.hours * 3600);

    await insertShift({
      id: `shift_${endTime}`,
      platform,
      vehicleId,
      startTime: endTime - durationSeconds * 1000,
      endTime,
      durationSeconds,
      grossRevenue: math.gross,
      activeMileage: math.distance,
      distanceSource: "manual",
      reconciliationStatus: "reconciled",
      notes: "Your first shift — logged during setup. Tap to correct the date or details.",
    } as any);
  };

  const handleContinue = () => {
    if (stepIndex === STEP_LOCATION) {
      setStepIndex(STEP_LAST_SHIFT);
      return;
    }

    // Last-shift step — validate, then compute the reveal.
    const h = Number(hours);
    const g = Number(gross);
    if (!platform) return setShiftError("Pick the app you drove for.");
    if (!(h > 0)) return setShiftError("Roughly how many hours were you out?");
    if (!(g > 0)) return setShiftError("How much did you make on that shift?");

    setShiftError("");
    setRevealMath(
      computeFirstShift({
        country,
        taxRegion,
        gross: g,
        hours: h,
        distance: Number(distance) || 0,
      })
    );
  };

  const handleBack = () => {
    if (stepIndex === STEP_LOCATION) {
      setShowWelcome(true);
      return;
    }
    setShiftError("");
    setStepIndex(STEP_LOCATION);
  };

  /** Reveal CTA — everything is written here, so a driver who bails mid-flow leaves no residue. */
  const handleEnterDashboard = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await persistSetup();
      if (revealMath) await persistFirstShift(revealMath);
    } finally {
      setIsFinishing(false);
    }
  };

  // ── Welcome-screen paths ────────────────────────────────────────────────────
  const handleChooseGoogleSync = () => {
    // The cloud snapshot carries EVERYTHING — records AND the synced profile (name, country,
    // units, onboarding flag) — so no setup wizard: go straight to the Cloud Sync hub. Once
    // the user connects + sets the sync password, the hub runs the restore sync itself and
    // redirects to the dashboard when the imported profile completes onboarding.
    setShowRestoreChooser(false);
    router.push("/settings/backup");
  };

  const handleChooseBackupFile = async () => {
    if (isRestoringFile) return;
    setIsRestoringFile(true);
    setRestoreError("");
    try {
      const res = await restoreBackupFile();
      if (!res.restored) return; // picker cancelled — stay on the chooser
      // The restored settings carry the source phone's profile + onboarding flag; re-hydrate
      // the store so the gate above this wizard swaps straight to the dashboard.
      await loadSettings();
      setShowRestoreChooser(false);
    } catch (e: any) {
      setRestoreError(e?.message ?? "Restore failed.");
    } finally {
      setIsRestoringFile(false);
    }
  };

  const handleDemoMode = async () => {
    setIsDemoLoading(true);
    const profile: DriverProfile = {
      displayName: "Hustler",
      country: "CA",
      taxRegion: "ON",
      operationalModelId: "delivery_fixed",
      avatarType: "emoji",
      avatarData: "#22c55e",
      selectedPlatforms: ["doordash", "ubereats", "skip"],
      workSchedulePreset: "flexible",
      weeklyGoal: 500,
      monthlyGoal: 2165,
      annualGoal: 26000,
      taxWithholdingPct: 25,
      hstRegistered: false,
      distanceUnit: "km",
      theme: "dark",
      accentColor: "#22c55e",
      locale: { weekStartDay: 1, timeFormat: "12h" },
    };
    const vehicle: VehicleDraft = {
      nickname: "Prius Prime",
      type: "hybrid",
      make: "Toyota",
      model: "Prius Prime",
      year: "2020",
    };
    await completeOnboarding(profile, vehicle, null);
    await loadSampleData();
  };

  // ── Screens ─────────────────────────────────────────────────────────────────

  if (showWelcome) {
    return (
      <>
        <WelcomeScreen
          onStart={() => setShowWelcome(false)}
          onDemo={handleDemoMode}
          onRestoreSync={() => {
            setRestoreError("");
            setShowRestoreChooser(true);
          }}
          demoLoading={isDemoLoading}
        />

        {showRestoreChooser ? (
          <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={() => !isRestoringFile && setShowRestoreChooser(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: COLORS.scrim,
                justifyContent: "center",
                padding: 24,
              }}
            >
              <View
                style={{
                  backgroundColor: COLORS.card,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: COLORS.lineSubtle,
                  padding: 20,
                  gap: 10,
                }}
              >
                <Text variant="headingS">Restore / Sync</Text>
                <Text variant="paragraphS">Bring your existing Comma data onto this phone.</Text>

                <Pressable
                  onPress={isRestoringFile ? undefined : handleChooseGoogleSync}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isRestoringFile }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: COLORS.surface03,
                    borderWidth: 1,
                    borderColor: COLORS.lineStrong,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <GoogleDriveLogo size={22} />
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM">Google Cloud Sync</Text>
                    <Text variant="paragraphS" style={{ marginTop: 2 }}>
                      Connect Drive — pulls your profile and all your data, no setup needed
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={isRestoringFile ? undefined : handleChooseBackupFile}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isRestoringFile }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: COLORS.surface03,
                    borderWidth: 1,
                    borderColor: COLORS.lineStrong,
                    borderRadius: 14,
                    padding: 14,
                    opacity: isRestoringFile ? 0.6 : 1,
                  }}
                >
                  {isRestoringFile ? (
                    <ActivityIndicator size="small" color={COLORS.contentSecondary} />
                  ) : (
                    <FileDown size={22} color={COLORS.contentSecondary} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM">{isRestoringFile ? "Restoring…" : "Backup file"}</Text>
                    <Text variant="paragraphS" style={{ marginTop: 2 }}>
                      Restore a comma-backup .json file made on another phone
                    </Text>
                  </View>
                </Pressable>

                {restoreError ? (
                  <Text variant="paragraphS" style={{ color: COLORS.destructive }}>
                    {restoreError}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => !isRestoringFile && setShowRestoreChooser(false)}
                  accessibilityRole="button"
                  style={{ alignItems: "center", paddingVertical: 10 }}
                >
                  <Text variant="labelM" style={{ color: COLORS.contentMuted }}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : null}
      </>
    );
  }

  if (revealMath) {
    return <FirstShiftReveal math={revealMath} onEnter={handleEnterDashboard} />;
  }

  if (showNoShiftYet) {
    return <NoShiftYetStep onEnter={handleEnterDashboard} />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Progress bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 8,
            gap: 6,
          }}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: i === stepIndex ? 2 : 1,
                borderRadius: 2,
                backgroundColor: i <= stepIndex ? COLORS.contentPrimary : COLORS.surface04,
              }}
            />
          ))}
        </View>

        {/* Step content */}
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
          {isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <ActivityIndicator size="large" color={COLORS.contentPrimary} />
              <Text variant="paragraphS">Setting up your vault…</Text>
            </View>
          ) : stepIndex === STEP_LOCATION ? (
            <CountryRegionStep
              country={country}
              onCountryChange={(c) => {
                setCountry(c);
                setTaxRegion(c === "CA" ? "ON" : c === "US" ? "CA" : c === "NP" ? "P3" : "ENG");
                setPlatform(""); // platform lists are country-scoped
              }}
              taxRegion={taxRegion}
              onRegionChange={setTaxRegion}
            />
          ) : (
            <LastShiftStep
              country={country}
              platform={platform}
              onPlatformChange={(id) => {
                setPlatform(id);
                setShiftError("");
              }}
              hours={hours}
              onHoursChange={setHours}
              gross={gross}
              onGrossChange={setGross}
              distance={distance}
              onDistanceChange={setDistance}
              currencySymbol={countryDef.symbol}
              distanceUnit={countryDef.distanceUnit}
              onSkip={() => setShowNoShiftYet(true)}
            />
          )}
        </View>

        {/* Navigation */}
        {!isLoading && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
            {shiftError ? (
              <Text
                variant="paragraphS"
                style={{ color: COLORS.destructive, marginBottom: 10, textAlign: "center" }}
              >
                {shiftError}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 16,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: COLORS.lineSubtle,
              }}
            >
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                style={{ paddingVertical: 12, paddingHorizontal: 4 }}
              >
                <Text variant="labelM" style={{ color: COLORS.contentMuted }}>
                  Back
                </Text>
              </Pressable>

              <Pressable
                onPress={handleContinue}
                accessibilityRole="button"
                style={{
                  backgroundColor: COLORS.contentPrimary,
                  paddingVertical: 14,
                  paddingHorizontal: 36,
                  borderRadius: 14,
                }}
              >
                <Text variant="labelL" style={{ color: COLORS.background }}>
                  {stepIndex === STEP_LAST_SHIFT ? "Show me" : "Continue"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
