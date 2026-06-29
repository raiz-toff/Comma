import React, { useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../src/components/ui/text";
import { useSettingsStore, type DriverProfile, type VehicleDraft } from "../store/useSettingsStore";
import { getCountryDef } from "../src/registry/countries/index";
import { type OperationalModelId } from "../src/registry/index";
import {
  WelcomeScreen,
  PersonaStep,
  CountryStep,
  RegionStep,
  BranchStep,
  VehicleStep,
  GoalStep,
  NameStep,
  GPSStep,
  RevealStep,
} from "./OnboardingSteps";
import DevGPSTestScreen from "./DevGPSTestScreen";
type WorkType = "delivery" | "business" | "contractor" | "mileage";

const WORK_TYPE_TO_OPERATIONAL_MODEL: Record<WorkType, OperationalModelId> = {
  delivery: "delivery_fixed",
  business: "rideshare_metered",
  contractor: "delivery_negotiated",
  mileage: "parcel_route",
};

const TOTAL_STEPS = 8;

function getStepSequence(country: string, workType: WorkType): number[] {
  const steps = [0, 1];
  if (country !== "NP") steps.push(2);
  if (workType !== "mileage") steps.push(3);
  steps.push(4, 5, 6, 7);
  return steps;
}

export default function OnboardingWizard() {
  const { completeOnboarding, loadSampleData, isLoading } = useSettingsStore();
  const insets = useSafeAreaInsets();

  const [showWelcome, setShowWelcome] = useState(true);
  const [showDevDemo, setShowDevDemo] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Persona
  const [workType, setWorkType] = useState<WorkType>("delivery");

  // Country / region
  const [country, setCountry] = useState<"US" | "CA" | "UK" | "NP">("CA");
  const [taxRegion, setTaxRegion] = useState("ON");

  // Branch step
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState("Other");
  const [clientType, setClientType] = useState("multiple");

  // Vehicle
  const [vehicleNickname, setVehicleNickname] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");

  // Goal + name
  const [weeklyGoal, setWeeklyGoal] = useState("500");
  const [displayName, setDisplayName] = useState("");

  const sequence = getStepSequence(country, workType);
  const currentStep = sequence[stepIndex] ?? 0;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === sequence.length - 1;

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const validate = (): boolean => {
    if (currentStep === 3 && workType === "delivery" && selectedPlatforms.length === 0) {
      Alert.alert("Select at least one platform", "You can always change this in Settings.");
      return false;
    }
    if (currentStep === 4 && !vehicleNickname.trim()) {
      Alert.alert("Vehicle name required", "Give your vehicle a nickname to continue.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    if (isLast) {
      handleComplete();
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
    const operationalModelId = WORK_TYPE_TO_OPERATIONAL_MODEL[workType];
    const weekly = Number(weeklyGoal) || 500;

    return {
      displayName: displayName.trim() || "Driver",
      country,
      taxRegion,
      operationalModelId,
      avatarType: "emoji",
      avatarData: "🚗",
      selectedPlatforms: workType === "delivery" ? selectedPlatforms : [],
      workSchedulePreset: "flexible",
      weeklyGoal: weekly,
      monthlyGoal: Math.round(weekly * 4.33),
      annualGoal: weekly * 52,
      taxWithholdingPct: countryDef.tax.defaultWithholdingPct,
      hstRegistered: false,
      distanceUnit: countryDef.distanceUnit,
      theme: "dark",
    };
  };

  const handleComplete = () => {
    setShowReveal(true);
  };

  const handleEnterDashboard = async () => {
    const profile = buildProfile();
    const vehicle: VehicleDraft = {
      nickname: vehicleNickname.trim() || "My Vehicle",
      type: vehicleType,
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      year: vehicleYear.trim(),
    };
    await completeOnboarding(profile, vehicle, null, true);
  };

  const handleDemoMode = async () => {
    const profile: DriverProfile = {
      displayName: "Jane Doe",
      country: "CA",
      taxRegion: "ON",
      operationalModelId: "delivery_fixed",
      avatarType: "emoji",
      avatarData: "🚗",
      selectedPlatforms: ["doordash", "ubereats", "skip"],
      workSchedulePreset: "flexible",
      weeklyGoal: 500,
      monthlyGoal: 2165,
      annualGoal: 26000,
      taxWithholdingPct: 25,
      hstRegistered: false,
      distanceUnit: "km",
      theme: "dark",
    };
    const vehicle: VehicleDraft = { nickname: "Prius Prime", type: "hybrid", make: "Toyota", model: "Prius Prime", year: "2020" };
    await completeOnboarding(profile, vehicle, null);
    await loadSampleData();
  };

  if (showDevDemo) {
    return <DevGPSTestScreen onClose={() => setShowDevDemo(false)} />;
  }

  if (showWelcome) {
    return (
      <WelcomeScreen
        onStart={() => setShowWelcome(false)}
        onDemo={handleDemoMode}
        onDevDemo={() => setShowDevDemo(true)}
      />
    );
  }

  if (showReveal) {
    return (
      <RevealStep
        displayName={displayName.trim() || "Driver"}
        workType={workType}
        selectedPlatforms={selectedPlatforms}
        businessType={businessType}
        country={country}
        weeklyGoal={weeklyGoal}
        onEnter={handleEnterDashboard}
      />
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonaStep value={workType} onChange={setWorkType} />;
      case 1:
        return (
          <CountryStep
            value={country}
            onChange={(c) => {
              setCountry(c);
              setTaxRegion(c === "CA" ? "ON" : c === "US" ? "CA" : c === "NP" ? "P3" : "ENG");
            }}
          />
        );
      case 2:
        return (
          <RegionStep
            country={country as "US" | "CA" | "UK" | "NP"}
            value={taxRegion}
            onChange={setTaxRegion}
          />
        );
      case 3:
        return (
          <BranchStep
            workType={workType}
            country={country}
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
            businessType={businessType}
            setBusinessType={setBusinessType}
            clientType={clientType}
            setClientType={setClientType}
          />
        );
      case 4:
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
          />
        );
      case 5:
        return (
          <GoalStep
            value={weeklyGoal}
            onChange={setWeeklyGoal}
            country={country}
            workType={workType}
          />
        );
      case 6:
        return <NameStep value={displayName} onChange={setDisplayName} />;
      case 7:
        return <GPSStep workType={workType} onNext={handleNext} />;
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Progress */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {sequence.map((_, i) => (
            <View
              key={i}
              style={{
                height: 4,
                width: i === stepIndex ? 20 : 6,
                borderRadius: 2,
                backgroundColor: i <= stepIndex ? "#ffffff" : "#27272a",
              }}
            />
          ))}
        </View>
        <Text style={{ fontSize: 10, fontWeight: "700", color: "#52525b", letterSpacing: 1, textTransform: "uppercase" }}>
          {stepIndex + 1} / {sequence.length}
        </Text>
      </View>

      {/* Step content */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{ fontSize: 12, color: "#7a7670" }}>Setting up your vault…</Text>
          </View>
        ) : (
          renderStep()
        )}
      </View>

      {/* Navigation — hidden on GPS step (it controls its own next) */}
      {currentStep !== 7 && !isLoading && (
        <View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderTopWidth: 0.8,
          borderTopColor: "#1f1f1f",
        }}>
          <Pressable
            onPress={handleBack}
            style={{ paddingVertical: 12, paddingHorizontal: 4 }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#7a7670" }}>
              {isFirst ? "Cancel" : "Back"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleNext}
            style={{
              backgroundColor: "#ffffff",
              paddingVertical: 14,
              paddingHorizontal: 36,
              borderRadius: 14,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#000000" }}>
              {isLast ? "Finish" : "Continue"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
