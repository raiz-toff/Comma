import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from "react-native";
import { Button } from "../src/components/ui/button";
import { Text } from "../src/components/ui/text";
import { useSettingsStore, type DriverProfile, type VehicleDraft } from "../store/useSettingsStore";
import { cn } from "../src/lib/utils";

// Import modular step components
import {
  CountrySelectStep,
  RegionSelectStep,
  PlatformsStep,
  DriverProfileStep,
  VehicleSetupStep,
  ScheduleStep,
  WeeklyGoalStep,
  LongTermGoalsStep,
  TaxWithholdingStep,
  SalesTaxStep,
  CompletionStep,
} from "./OnboardingSteps";

import { getCountryDef } from "../src/registry/countries/index";

const BackIcon = ({ color = "#b8b4ab" }) => (
  <View style={{ width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginRight: 4 }} />
);

const NextIcon = ({ color = "white" }) => (
  <View style={{ width: 10, height: 10, borderRightWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginLeft: 4 }} />
);

export default function OnboardingWizard() {
  const { completeOnboarding, loadSampleData, isLoading } = useSettingsStore();

  const [step, setStep] = useState(0);
  const [landingComplete, setLandingComplete] = useState(false);

  // Wizard State
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState<"US" | "CA" | "UK">("CA");
  const [taxRegion, setTaxRegion] = useState("ON");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [avatarType, setAvatarType] = useState<"emoji" | "initials" | "custom">("emoji");
  const [avatarData, setAvatarData] = useState("🚗");
  const [workSchedulePreset, setWorkSchedulePreset] = useState<"flexible" | "weekdays" | "evenings" | "weekends">("flexible");

  const [weeklyGoal, setWeeklyGoal] = useState("500");
  const [monthlyGoal, setMonthlyGoal] = useState("2165");
  const [annualGoal, setAnnualGoal] = useState("26000");

  const [taxWithholdingPct, setTaxWithholdingPct] = useState("25");
  const [hstRegistered, setHstRegistered] = useState(false);

  // Vehicle 1 State
  const [vehicleNickname, setVehicleNickname] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");

  // Vehicle 2 State
  const [addSecondVehicle, setAddSecondVehicle] = useState(false);
  const [vehicle2Nickname, setVehicle2Nickname] = useState("");
  const [vehicle2Type, setVehicle2Type] = useState("gas");
  const [vehicle2Make, setVehicle2Make] = useState("");
  const [vehicle2Model, setVehicle2Model] = useState("");
  const [vehicle2Year, setVehicle2Year] = useState("");

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      if (step === 0 && !landingComplete) {
        setLandingComplete(true);
      } else {
        setStep((s) => Math.min(s + 1, 10));
      }
    }
  };

  const handleBackStep = () => {
    if (step === 0 && landingComplete) {
      setLandingComplete(false);
    } else {
      setStep((s) => Math.max(s - 1, 0));
    }
  };

  const togglePlatform = (id: string) => {
    if (selectedPlatforms.includes(id)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== id));
    } else {
      setSelectedPlatforms([...selectedPlatforms, id]);
    }
  };

  const handleWeeklyGoalChange = (val: string) => {
    setWeeklyGoal(val);
    const num = Number(val) || 0;
    setMonthlyGoal(Math.round(num * 4.33).toString());
    setAnnualGoal(Math.round(num * 52).toString());
  };

  const validateCurrentStep = () => {
    if (!landingComplete && step === 0) return true;

    switch (step) {
      case 0:
        return !!country;
      case 1:
        return !!taxRegion;
      case 2:
        if (selectedPlatforms.length === 0) {
          Alert.alert("Required", "Please select at least one gig platform.");
          return false;
        }
        return true;
      case 3:
        if (!displayName.trim()) {
          Alert.alert("Required", "Please enter a driver display name.");
          return false;
        }
        return true;
      case 4:
        if (!vehicleNickname.trim()) {
          Alert.alert("Required", "Please enter a primary vehicle nickname.");
          return false;
        }
        if (addSecondVehicle && !vehicle2Nickname.trim()) {
          Alert.alert("Required", "Please enter a secondary vehicle nickname.");
          return false;
        }
        return true;
      case 5:
        return true;
      case 6:
        if (Number(weeklyGoal) <= 0 || isNaN(Number(weeklyGoal))) {
          Alert.alert("Invalid Input", "Please enter a valid weekly earnings goal.");
          return false;
        }
        return true;
      case 7:
        return true;
      case 8:
        const pct = Number(taxWithholdingPct);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          Alert.alert("Invalid Input", "Please enter a valid tax withholding percentage (0-100).");
          return false;
        }
        return true;
      case 9:
        return true;
      default:
        return true;
    }
  };

  const handleComplete = async () => {
    const profileData: DriverProfile = {
      displayName: displayName.trim(),
      country,
      taxRegion,
      avatarType: avatarType === "initials" ? "initials" : "emoji",
      avatarData,
      selectedPlatforms,
      workSchedulePreset,
      weeklyGoal: Number(weeklyGoal),
      monthlyGoal: Number(monthlyGoal),
      annualGoal: Number(annualGoal),
      taxWithholdingPct: Number(taxWithholdingPct),
      hstRegistered: country === "CA" ? hstRegistered : false,
      distanceUnit: getCountryDef(country).distanceUnit,
      theme: "dark",
    };

    const vehicleData: VehicleDraft = {
      nickname: vehicleNickname.trim(),
      type: vehicleType,
      make: vehicleMake.trim(),
      model: vehicleModel.trim(),
      year: vehicleYear.trim(),
    };

    const vehicle2Data: VehicleDraft | null = addSecondVehicle ? {
      nickname: vehicle2Nickname.trim(),
      type: vehicle2Type,
      make: vehicle2Make.trim(),
      model: vehicle2Model.trim(),
      year: vehicle2Year.trim(),
    } : null;

    await completeOnboarding(profileData, vehicleData, vehicle2Data);
  };

  const handleDemoMode = async () => {
    const profileData: DriverProfile = {
      displayName: "Jane Doe (Demo)",
      country: "CA",
      taxRegion: "ON",
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

    const vehicleData: VehicleDraft = {
      nickname: "Prius Prime",
      type: "hybrid",
      make: "Toyota",
      model: "Prius Prime",
      year: "2020",
    };

    await completeOnboarding(profileData, vehicleData, null);
    await loadSampleData();
  };

  const handleExportSetup = () => {
    const setupExport = {
      exportKind: "comma_setup",
      version: 1,
      displayName: displayName.trim(),
      country,
      taxRegion,
      selectedPlatforms,
      weeklyGoal: Number(weeklyGoal),
      monthlyGoal: Number(monthlyGoal),
      annualGoal: Number(annualGoal),
      taxWithholdingPct: Number(taxWithholdingPct),
      hstRegistered,
      vehicles: [
        { nickname: vehicleNickname, type: vehicleType, make: vehicleMake, model: vehicleModel, year: vehicleYear },
        ...(addSecondVehicle ? [{ nickname: vehicle2Nickname, type: vehicle2Type, make: vehicle2Make, model: vehicle2Model, year: vehicle2Year }] : [])
      ]
    };
    Alert.alert("Export Setup File", JSON.stringify(setupExport, null, 2));
  };

  const handleConnectDrive = () => {
    Alert.alert("Google Drive Sync", "Google Drive connection will be available post-onboarding from Settings.");
  };

  const renderWizardStepContent = () => {
    switch (step) {
      case 0:
        return (
          <CountrySelectStep
            country={country}
            setCountry={setCountry}
            setTaxRegion={setTaxRegion}
          />
        );
      case 1:
        return (
          <RegionSelectStep
            country={country}
            taxRegion={taxRegion}
            setTaxRegion={setTaxRegion}
          />
        );
      case 2:
        return (
          <PlatformsStep
            country={country}
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
          />
        );
      case 3:
        return (
          <DriverProfileStep
            displayName={displayName}
            setDisplayName={setDisplayName}
            avatarType={avatarType}
            setAvatarType={setAvatarType}
            avatarData={avatarData}
            setAvatarData={setAvatarData}
          />
        );
      case 4:
        return (
          <VehicleSetupStep
            vehicleNickname={vehicleNickname}
            setVehicleNickname={setVehicleNickname}
            vehicleType={vehicleType}
            setVehicleType={setVehicleType}
            vehicleMake={vehicleMake}
            setVehicleMake={setVehicleMake}
            vehicleModel={vehicleModel}
            setVehicleModel={setVehicleModel}
            vehicleYear={vehicleYear}
            setVehicleYear={setVehicleYear}
            addSecondVehicle={addSecondVehicle}
            setAddSecondVehicle={setAddSecondVehicle}
            vehicle2Nickname={vehicle2Nickname}
            setVehicle2Nickname={setVehicle2Nickname}
            vehicle2Type={vehicle2Type}
            setVehicle2Type={setVehicle2Type}
            vehicle2Make={vehicle2Make}
            setVehicle2Make={setVehicle2Make}
            vehicle2Model={vehicle2Model}
            setVehicle2Model={setVehicle2Model}
            vehicle2Year={vehicle2Year}
            setVehicle2Year={setVehicle2Year}
          />
        );
      case 5:
        return (
          <ScheduleStep
            workSchedulePreset={workSchedulePreset}
            setWorkSchedulePreset={setWorkSchedulePreset}
          />
        );
      case 6:
        return (
          <WeeklyGoalStep
            weeklyGoal={weeklyGoal}
            handleWeeklyGoalChange={handleWeeklyGoalChange}
          />
        );
      case 7:
        return (
          <LongTermGoalsStep
            monthlyGoal={monthlyGoal}
            setMonthlyGoal={setMonthlyGoal}
            annualGoal={annualGoal}
            setAnnualGoal={setAnnualGoal}
          />
        );
      case 8:
        return (
          <TaxWithholdingStep
            country={country}
            taxRegion={taxRegion}
            taxWithholdingPct={taxWithholdingPct}
            setTaxWithholdingPct={setTaxWithholdingPct}
          />
        );
      case 9:
        return (
          <SalesTaxStep
            country={country}
            hstRegistered={hstRegistered}
            setHstRegistered={setHstRegistered}
            setStep={setStep}
          />
        );
      case 10:
        return (
          <CompletionStep
            displayName={displayName}
            handleComplete={handleComplete}
            handleDemoMode={handleDemoMode}
            handleExportSetup={handleExportSetup}
            handleConnectDrive={handleConnectDrive}
          />
        );
      default:
        return null;
    }
  };

  // Render Full Landing Page (if landingComplete is false)
  if (!landingComplete) {
    return (
      <View className="flex-1 bg-[#12110f]">
        <ScrollView contentContainerClassName="px-6 py-12 flex flex-col gap-10">
          
          {/* Logo and Header */}
          <View className="flex flex-col items-center gap-1.5">
            <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center mb-1">
              <Text className="text-2xl font-black text-white">C</Text>
            </View>
            <Text className="text-xs font-bold text-primary tracking-widest uppercase">
              INTRODUCING COMMA
            </Text>
          </View>
 
          {/* Hero Section */}
          <View className="flex flex-col gap-4 items-center">
            <Text className="text-4xl font-extrabold text-[#f4f2ed] text-center tracking-tight leading-tight">
              Take control of your road
            </Text>
            <Text className="text-[#b8b4ab] text-sm text-center leading-relaxed max-w-sm">
              Track earnings, optimize mileage, write off taxes, and back up securely to your own cloud.
            </Text>

            <View className="w-full flex flex-col gap-3 mt-4 max-w-xs">
              <Button
                onPress={handleNextStep}
                className="bg-primary py-3.5 rounded-xl shadow-lg shadow-primary/20"
              >
                <Text className="font-bold text-white text-base">START SETUP</Text>
              </Button>
              <Button
                onPress={handleDemoMode}
                variant="outline"
                className="border-[#3d3a35] bg-[#1c1b18]/50 py-3.5 rounded-xl"
              >
                <Text className="font-semibold text-[#b8b4ab] text-base">TRY DEMO</Text>
              </Button>
            </View>
          </View>

          {/* Web App Image Screenshot for Hero */}
          <View className="w-full bg-[#1c1b18] border border-[#3d3a35] rounded-2xl overflow-hidden shadow-2xl p-1.5 mt-3">
            <Image
              source={require("../assets/image.png")}
              style={{ width: "100%", height: 260, resizeMode: "contain" }}
              className="rounded-xl"
            />
          </View>

          {/* Divider */}
          <View className="h-[1px] bg-[#3d3a35] w-full" />

          {/* Product Features List */}
          <View className="flex flex-col gap-9">
            
            {/* Feature 1: Analytics */}
            <View className="flex flex-col gap-3">
              <View className="flex flex-col gap-1">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">Analytics</Text>
                <Text className="text-xl font-bold text-[#f4f2ed]">Track shifts automatically</Text>
              </View>
              <Text className="text-[#b8b4ab] text-sm leading-relaxed">
                Record gross earnings, tips, active hours, and distance with single-tap precision.
              </Text>
              <View className="w-full bg-[#1c1b18] border border-[#3d3a35] rounded-xl overflow-hidden p-1.5">
                <Image
                  source={require("../assets/image.png")}
                  style={{ width: "100%", height: 200, resizeMode: "contain" }}
                  className="rounded-lg"
                />
              </View>
            </View>

            {/* Feature 2: Finance */}
            <View className="flex flex-col gap-3">
              <View className="flex flex-col gap-1">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">Finance</Text>
                <Text className="text-xl font-bold text-[#f4f2ed]">Tax estimations and vehicle deductions</Text>
              </View>
              <Text className="text-[#b8b4ab] text-sm leading-relaxed">
                Auto-calculate your write-offs using local standard mileage rates, estimating net income in real-time.
              </Text>
              <View className="w-full bg-[#1c1b18] border border-[#3d3a35] rounded-xl overflow-hidden p-1.5">
                <Image
                  source={require("../assets/image-1.png")}
                  style={{ width: "100%", height: 200, resizeMode: "contain" }}
                  className="rounded-lg"
                />
              </View>
            </View>

            {/* Feature 3: Workflow */}
            <View className="flex flex-col gap-3">
              <View className="flex flex-col gap-1">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">Workflow</Text>
                <Text className="text-xl font-bold text-[#f4f2ed]">Multi-Platform Mastery</Text>
              </View>
              <Text className="text-[#b8b4ab] text-sm leading-relaxed">
                Switch between platforms effortlessly. COMMA adapts its terminology and tracking to match exactly how you work.
              </Text>
              <View className="w-full bg-[#1c1b18] border border-[#3d3a35] rounded-xl overflow-hidden p-1.5">
                <Image
                  source={require("../assets/image-2.png")}
                  style={{ width: "100%", height: 200, resizeMode: "contain" }}
                  className="rounded-lg"
                />
              </View>
            </View>

            {/* Feature 4: Privacy */}
            <View className="flex flex-col gap-3">
              <View className="flex flex-col gap-1">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider">Privacy First</Text>
                <Text className="text-xl font-bold text-[#f4f2ed]">Self-sovereign data</Text>
              </View>
              <Text className="text-[#b8b4ab] text-sm leading-relaxed">
                Your data is encrypted and saved directly to your personal Google Drive or local storage. No central servers.
              </Text>
              <View className="w-full bg-[#1c1b18] border border-[#3d3a35] rounded-xl overflow-hidden p-1.5">
                <Image
                  source={require("../assets/image-3.png")}
                  style={{ width: "100%", height: 200, resizeMode: "contain" }}
                  className="rounded-lg"
                />
              </View>
            </View>

          </View>

          {/* Footer */}
          <View className="flex flex-col items-center gap-4 pt-4 pb-8 border-t border-[#3d3a35]">
            <View className="flex flex-row gap-3">
              <Text className="text-xs text-[#7a7670]">Privacy Policy</Text>
              <Text className="text-xs text-[#3d3a35]">•</Text>
              <Text className="text-xs text-[#7a7670]">Terms</Text>
            </View>
            <Text className="text-[10px] text-[#7a7670]">
              © 2026 COMMA
            </Text>
          </View>

        </ScrollView>
      </View>
    );
  }

  // Render Onboarding Wizard Card (if landingComplete is true)
  return (
    <View className="flex-1 bg-[#12110f] px-6 pt-14 pb-6">
      {/* Pinned Header: Progress Dots */}
      <View className="flex flex-row justify-between items-center mb-6 max-w-md w-full mx-auto">
        <View className="flex flex-row gap-1.5 items-center">
          {Array.from({ length: 11 }).map((_, idx) => {
            const isCompleted = idx < step;
            const isCurrent = idx === step;
            return (
              <View
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  isCurrent ? "w-5 bg-primary" : isCompleted ? "w-2 bg-emerald-500" : "w-1.5 bg-[#3d3a35]"
                )}
              />
            );
          })}
        </View>
        <Text className="text-[9px] font-bold text-[#7a7670] uppercase tracking-wide">
          Step {step + 1} of 11
        </Text>
      </View>

      {/* Main Content Container (No Card box frame) */}
      <View className="flex-1 max-w-md w-full mx-auto justify-center">
        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#10b981" />
            <Text className="text-[#7a7670] text-xs mt-3">Persisting configuration...</Text>
          </View>
        ) : (
          renderWizardStepContent()
        )}
      </View>

      {/* Navigation Buttons Pinned at Footer */}
      {step < 10 && !isLoading && (
        <View className="flex flex-row justify-between items-center max-w-md w-full mx-auto mt-6 pt-4 border-t border-[#3d3a35]/40 bg-[#12110f]">
          <Button
            variant="ghost"
            className="flex flex-row items-center text-[#b8b4ab] py-2.5 px-4"
            onPress={handleBackStep}
          >
            <BackIcon />
            <Text className="font-semibold text-[#b8b4ab] text-sm">Back</Text>
          </Button>

          <Button
            className="bg-primary flex flex-row items-center px-6 py-2.5 rounded-lg"
            onPress={handleNextStep}
          >
            <Text className="font-bold text-white text-sm">Next</Text>
            <NextIcon />
          </Button>
        </View>
      )}
    </View>
  );
}
