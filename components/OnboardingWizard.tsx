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
  NameStep,
  CountryStep,
  RegionStep,
  PlatformStep,
  VehicleStep,
  GoalStep,
  AppearanceStep,
  PreferencesStep,
  GPSStep,
  RevealStep,
} from "./OnboardingSteps";

// Step indices — used as identifiers, not array positions
const STEP_NAME = 0;
const STEP_COUNTRY = 1;
const STEP_REGION = 2;
const STEP_PLATFORMS = 3;
const STEP_VEHICLE = 4;
const STEP_GOAL = 5;
const STEP_APPEARANCE = 6;
const STEP_PREFERENCES = 7;
const STEP_GPS = 8;

function getStepSequence(country: string): number[] {
  const steps = [STEP_NAME, STEP_COUNTRY];
  if (country !== "NP") steps.push(STEP_REGION);
  steps.push(
    STEP_PLATFORMS,
    STEP_VEHICLE,
    STEP_GOAL,
    STEP_APPEARANCE,
    STEP_PREFERENCES,
    STEP_GPS
  );
  return steps;
}

// Default all user-toggleable features to on
const DEFAULT_FEATURES: Partial<Record<FeatureKey, boolean>> = {
  analytics_advanced: true,
  tax_workspace: true,
  goals: true,
  schedule: false,
  pdf_reports: true,
};

export default function OnboardingWizard() {
  const { completeOnboarding, updateFeatureOverride, loadSampleData, loadSettings, isLoading } = useSettingsStore();
  const insets = useSafeAreaInsets();

  const [showWelcome, setShowWelcome] = useState(true);
  const [showReveal, setShowReveal] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // "Restore / Sync existing data" chooser (welcome screen third option)
  const [showRestoreChooser, setShowRestoreChooser] = useState(false);
  const [isRestoringFile, setIsRestoringFile] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  // Name
  const [displayName, setDisplayName] = useState("");

  // Country / region
  const [country, setCountry] = useState<"US" | "CA" | "UK" | "NP">("CA");
  const [taxRegion, setTaxRegion] = useState("ON");

  // Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Vehicle
  const [vehicleNickname, setVehicleNickname] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [mileageOptOut, setMileageOptOut] = useState(false);
  const [mileageRateOverride, setMileageRateOverride] = useState("");

  // Goal
  const [weeklyGoal, setWeeklyGoal] = useState("500");

  // Appearance
  const [theme, setTheme] = useState<"dark" | "light" | "auto">("dark");
  const [accentColor, setAccentColor] = useState("#F6F6F7"); // near-white default preserves the monochrome look

  // Preferences
  const [weekStartDay, setWeekStartDay] = useState(1); // Monday
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [featureOverrides, setFeatureOverrides] = useState<Partial<Record<FeatureKey, boolean>>>(
    DEFAULT_FEATURES
  );

  const sequence = getStepSequence(country);
  const currentStep = sequence[stepIndex] ?? STEP_NAME;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === sequence.length - 1;

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleFeature = (key: FeatureKey) => {
    setFeatureOverrides((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    if (isLast) {
      setShowReveal(true);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (isFirst) {
      setShowWelcome(true);
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const buildProfile = (): DriverProfile => {
    const countryDef = getCountryDef(country);
    const weekly = Number(weeklyGoal) || 500;

    return {
      displayName: displayName.trim() || "Driver",
      country,
      taxRegion,
      operationalModelId: "delivery_fixed",
      avatarType: "emoji",
      avatarData: accentColor,
      selectedPlatforms,
      workSchedulePreset: "flexible",
      weeklyGoal: weekly,
      monthlyGoal: Math.round(weekly * 4.33),
      annualGoal: weekly * 52,
      taxWithholdingPct: countryDef.tax.defaultWithholdingPct,
      hstRegistered: false,
      distanceUnit: countryDef.distanceUnit,
      theme,
      accentColor,
      locale: {
        weekStartDay,
        timeFormat,
      },
    };
  };

  const handleEnterDashboard = async () => {
    const profile = buildProfile();
    const vehicle: VehicleDraft = {
      nickname: vehicleNickname.trim() || "My Vehicle",
      type: vehicleType,
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      year: vehicleYear.trim(),
      mileageOptOut,
      mileageRateOverride: mileageRateOverride.trim(),
    };
    await completeOnboarding(profile, vehicle, null, true);

    // Apply feature overrides after onboarding is complete
    for (const [key, val] of Object.entries(featureOverrides)) {
      await updateFeatureOverride(key as FeatureKey, val as boolean);
    }
  };

  // ── "Restore / Sync existing data" (welcome third option) ────────────────────
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
                <Text variant="paragraphS">
                  Bring your existing Comma data onto this phone.
                </Text>

                <Pressable
                  onPress={isRestoringFile ? undefined : handleChooseGoogleSync}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isRestoringFile }}
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
                >
                  {isRestoringFile ? (
                    <ActivityIndicator size="small" color={COLORS.contentSecondary} />
                  ) : (
                    <FileDown size={22} color={COLORS.contentSecondary} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM">
                      {isRestoringFile ? "Restoring…" : "Backup file"}
                    </Text>
                    <Text variant="paragraphS" style={{ marginTop: 2 }}>
                      Restore a comma-backup .json file made on another phone
                    </Text>
                  </View>
                </Pressable>

                {restoreError ? (
                  <Text variant="paragraphS" style={{ color: COLORS.destructive }}>{restoreError}</Text>
                ) : null}

                <Pressable
                  onPress={() => !isRestoringFile && setShowRestoreChooser(false)}
                  accessibilityRole="button"
                >
                  <Text variant="labelM" style={{ color: COLORS.contentMuted }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : null}
      </>
    );
  }

  if (showReveal) {
    return (
      <RevealStep
        displayName={displayName.trim() || "Driver"}
        selectedPlatforms={selectedPlatforms}
        country={country}
        weeklyGoal={weeklyGoal}
        accentColor={accentColor}
        onEnter={handleEnterDashboard}
      />
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case STEP_NAME:
        return <NameStep value={displayName} onChange={setDisplayName} />;
      case STEP_COUNTRY:
        return (
          <CountryStep
            value={country}
            onChange={(c) => {
              setCountry(c);
              setTaxRegion(
                c === "CA" ? "ON" : c === "US" ? "CA" : c === "NP" ? "P3" : "ENG"
              );
            }}
          />
        );
      case STEP_REGION:
        return (
          <RegionStep
            country={country as "US" | "CA" | "UK" | "NP"}
            value={taxRegion}
            onChange={setTaxRegion}
          />
        );
      case STEP_PLATFORMS:
        return (
          <PlatformStep
            country={country}
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
          />
        );
      case STEP_VEHICLE:
        return (
          <VehicleStep
            nickname={vehicleNickname}
            setNickname={setVehicleNickname}
            type={vehicleType}
            setType={setVehicleType}
            make={vehicleMake}
            setMake={setVehicleMake}
            model={vehicleModel}
            setModel={setVehicleModel}
            year={vehicleYear}
            setYear={setVehicleYear}
            country={country}
            mileageOptOut={mileageOptOut}
            setMileageOptOut={setMileageOptOut}
            mileageRateOverride={mileageRateOverride}
            setMileageRateOverride={setMileageRateOverride}
          />
        );
      case STEP_GOAL:
        return (
          <GoalStep
            value={weeklyGoal}
            onChange={setWeeklyGoal}
            country={country}
          />
        );
      case STEP_APPEARANCE:
        return (
          <AppearanceStep
            theme={theme}
            setTheme={setTheme}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
          />
        );
      case STEP_PREFERENCES:
        return (
          <PreferencesStep
            weekStartDay={weekStartDay}
            setWeekStartDay={setWeekStartDay}
            timeFormat={timeFormat}
            setTimeFormat={setTimeFormat}
            featureOverrides={featureOverrides}
            toggleFeature={toggleFeature}
          />
        );
      case STEP_GPS:
        return <GPSStep onNext={handleNext} />;
      default:
        return null;
    }
  };

  const isGPSStep = currentStep === STEP_GPS;

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
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flex: 1 }}>
          {sequence.map((_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                flex: i === stepIndex ? 2 : 1,
                borderRadius: 2,
                // Filled segments borrow the chosen accent — theming starts during setup (§09-C).
                backgroundColor: i <= stepIndex ? (accentColor || COLORS.contentPrimary) : COLORS.surface04,
              }}
            />
          ))}
        </View>
      </View>

      {/* Step content */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
        {isLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator size="large" color={COLORS.contentPrimary} />
            <Text variant="paragraphS">
              Setting up your vault…
            </Text>
          </View>
        ) : (
          renderStep()
        )}
      </View>

      {/* Navigation — hidden on GPS step (it controls its own CTA) */}
      {!isGPSStep && !isLoading && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: COLORS.lineSubtle,
          }}
        >
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
          >
            <Text variant="labelM" style={{ color: COLORS.contentMuted }}>
              {isFirst ? "Cancel" : "Back"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
          >
            <Text variant="labelL" style={{ color: COLORS.background }}>
              {isLast ? "Finish" : "Continue"}
            </Text>
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </View>
  );
}
