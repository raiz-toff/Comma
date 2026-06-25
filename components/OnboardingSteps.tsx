import React from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Button } from "../src/components/ui/button";
import { Text } from "../src/components/ui/text";
import { cn } from "../src/lib/utils";
import { getCountryDef } from "../src/registry/countries/index";
import { getRegionsByCountry } from "../src/registry/provinces/index";
import { PLATFORMS, type PlatformKey } from "../src/registry/platforms";
import { getWithholdingPresetPct } from "../src/registry/tax/withholdingPresets";

// Custom vector icons implemented as pure Views to avoid react-native-svg native dependency
const CheckIcon = ({ color = "#10b981" }) => (
  <View style={{ width: 12, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: "-45deg" }] }} />
);

// Collapsible "Why we ask" component mirroring the legacy web HTML details/summary design
function WhyWeAsk({ summary, body }: { summary: string; body: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <View className="mb-4">
      <TouchableOpacity 
        onPress={() => setIsOpen(!isOpen)}
        className="flex flex-row items-center py-2 px-3 bg-[#1c1b18] border border-[#3d3a35] rounded-lg"
      >
        <View style={{ 
          width: 6, 
          height: 6, 
          borderRightWidth: 1.5, 
          borderBottomWidth: 1.5, 
          borderColor: "#b8b4ab", 
          transform: [{ rotate: isOpen ? "45deg" : "-45deg" }],
          marginRight: 8,
          marginTop: isOpen ? -1 : 1
        }} />
        <Text className="text-xs font-semibold text-[#b8b4ab]">{summary}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View className="p-3 bg-[#12110f] border-x border-b border-[#3d3a35] rounded-b-lg -mt-1">
          <Text className="text-xs text-[#b8b4ab] leading-relaxed">{body}</Text>
        </View>
      )}
    </View>
  );
}

const EMOJI_AVATARS = ["🚗", "🛵", "🚲", "📦", "⭐", "🔥", "💼", "🤑"];

const VEHICLE_TYPES = [
  { id: "gas", label: "Gas vehicle" },
  { id: "hybrid", label: "Hybrid" },
  { id: "ev", label: "Electric" },
  { id: "motorcycle", label: "Motorcycle" },
  { id: "bicycle", label: "Bicycle" },
  { id: "ebike", label: "E-bike" },
  { id: "scooter", label: "Scooter" },
  { id: "walking", label: "Walking" },
];

const SCHEDULE_PRESETS = [
  { id: "flexible", label: "Flexible hours" },
  { id: "weekdays", label: "Mostly weekdays" },
  { id: "evenings", label: "Evenings" },
  { id: "weekends", label: "Weekends" },
];

interface CountrySelectProps {
  country: "US" | "CA" | "UK";
  setCountry: (c: "US" | "CA" | "UK") => void;
  setTaxRegion: (r: string) => void;
}

export function CountrySelectStep({ country, setCountry, setTaxRegion }: CountrySelectProps) {
  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Which country do you drive in?</Text>
        <Text className="text-xs text-[#7a7670]">Currency and distance units follow your market.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="Currency and mileage rules follow your country so numbers stay trustworthy." 
      />

      <View className="flex flex-row gap-2">
        {(["CA", "US", "UK"] as const).map((cCode) => {
          let flag = "🇨🇦";
          let label = "Canada";
          let sub = "CAD ($) • Metric (km)";
          if (cCode === "US") {
            flag = "🇺🇸";
            label = "United States";
            sub = "USD ($) • Imperial (mi)";
          } else if (cCode === "UK") {
            flag = "🇬🇧";
            label = "United Kingdom";
            sub = "GBP (£) • Imperial (mi)";
          }
          return (
            <TouchableOpacity
              key={cCode}
              onPress={() => {
                setCountry(cCode);
                setTaxRegion(cCode === "CA" ? "ON" : cCode === "US" ? "NY" : "ENG");
              }}
              className={cn(
                "flex-1 p-3.5 rounded-xl bg-[#1c1b18] border border-[#3d3a35] items-center justify-center gap-2",
                country === cCode && "border-primary bg-primary/5"
              )}
            >
              <Text className="text-2xl">{flag}</Text>
              <Text className="font-bold text-[#f4f2ed] text-xs">
                {label}
              </Text>
              <Text className="text-[8px] text-[#7a7670] font-mono text-center">
                {sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface RegionSelectProps {
  country: "US" | "CA" | "UK";
  taxRegion: string;
  setTaxRegion: (r: string) => void;
}

export function RegionSelectStep({ country, taxRegion, setTaxRegion }: RegionSelectProps) {
  const regions = getRegionsByCountry(country);
  const countryDef = getCountryDef(country);
  const regionLabel = countryDef.tax.regionLabel;
  const label = regionLabel === "province" ? "Province or territory" : regionLabel === "state" ? "State" : "Region";

  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">{label}</Text>
        <Text className="text-xs text-[#7a7670]">Tax presets and catalog data use this where your country is supported.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="Currency and mileage rules follow your country so numbers stay trustworthy." 
      />

      <ScrollView className="max-h-72 border border-[#3d3a35] rounded-xl bg-[#1c1b18]/50 p-2">
        <View className="flex flex-col gap-1">
          {regions.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => setTaxRegion(r.id)}
              className={cn(
                "p-3.5 rounded-lg flex flex-row justify-between items-center bg-transparent",
                taxRegion === r.id && "bg-[#1c1b18] border border-[#3d3a35]"
              )}
            >
              <Text className="text-[#f4f2ed] font-semibold text-sm">{r.label}</Text>
              {taxRegion === r.id && <View className="w-4 h-4 items-center justify-center"><CheckIcon /></View>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface PlatformsProps {
  country: "US" | "CA" | "UK";
  selectedPlatforms: string[];
  togglePlatform: (id: string) => void;
}

export function PlatformsStep({ country, selectedPlatforms, togglePlatform }: PlatformsProps) {
  const countryDef = getCountryDef(country);
  const platformIds = countryDef.defaultAvailablePlatforms;
  const platformOptions = platformIds.map((id) => {
    const config = PLATFORMS[id as PlatformKey] || PLATFORMS.other;
    return {
      id,
      label: config.label,
      color: config.color,
    };
  });

  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Which platforms do you use?</Text>
        <Text className="text-xs text-[#7a7670]">Select every gig or delivery app you earn through. You can change this anytime.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="We use your choices to match labels, colors, and filters to the services you actually work with." 
      />

      <ScrollView className="max-h-80 pr-1">
        <View className="flex flex-col gap-2.5">
          {platformOptions.map((p) => {
            const isSelected = selectedPlatforms.includes(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => togglePlatform(p.id)}
                className={cn(
                  "p-4 rounded-xl bg-[#1c1b18] border border-[#3d3a35] flex flex-row items-center justify-between",
                  isSelected && "border-primary bg-primary/5"
                )}
              >
                <View className="flex flex-row items-center gap-3">
                  <View
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <Text className="font-bold text-[#f4f2ed]">{p.label}</Text>
                </View>
                {isSelected && <View className="w-4 h-4 items-center justify-center"><CheckIcon /></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}



interface DriverProfileProps {
  displayName: string;
  setDisplayName: (n: string) => void;
  avatarType: "emoji" | "initials" | "custom";
  setAvatarType: (t: "emoji" | "initials" | "custom") => void;
  avatarData: string;
  setAvatarData: (a: string) => void;
}

export function DriverProfileStep({ 
  displayName, 
  setDisplayName, 
  avatarType, 
  setAvatarType, 
  avatarData, 
  setAvatarData 
}: DriverProfileProps) {
  // Generate initials from the entered display name
  const getInitials = (name: string) => {
    if (!name.trim()) return "D";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">How should we greet you?</Text>
        <Text className="text-xs text-[#7a7670]">This name appears on your dashboard and exports.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="Exports and summaries read better with your name and a recognizable avatar." 
      />

      <View className="flex flex-col gap-4">
        <View className="flex flex-col gap-1.5">
          <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Your name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Alex"
            placeholderTextColor="#7a7670"
            className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
          />
        </View>

        <View className="flex flex-col gap-3">
          <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Avatar Style</Text>
          
          <View className="flex flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => {
                setAvatarType("emoji");
                setAvatarData("🚗");
              }}
              className={cn(
                "flex-1 p-2.5 rounded-lg border border-[#3d3a35] bg-[#1c1b18] items-center justify-center",
                avatarType === "emoji" && "border-primary bg-primary/5"
              )}
            >
              <Text className="text-xs font-bold text-[#f4f2ed]">Use Emoji</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setAvatarType("initials");
                setAvatarData(getInitials(displayName));
              }}
              className={cn(
                "flex-1 p-2.5 rounded-lg border border-[#3d3a35] bg-[#1c1b18] items-center justify-center",
                avatarType === "initials" && "border-primary bg-primary/5"
              )}
            >
              <Text className="text-xs font-bold text-[#f4f2ed]">Use Initials</Text>
            </TouchableOpacity>
          </View>

          {avatarType === "emoji" && (
            <View className="flex flex-row flex-wrap gap-2 pt-1.5">
              {EMOJI_AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setAvatarData(emoji)}
                  className={cn(
                    "w-10 h-10 rounded-full items-center justify-center bg-[#1c1b18] border border-[#3d3a35]",
                    avatarData === emoji && "border-primary bg-primary/10"
                  )}
                >
                  <Text className="text-lg">{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {avatarType === "initials" && (
            <View className="items-center py-4 bg-[#1c1b18] border border-[#3d3a35] rounded-xl mt-1">
              <View className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
                <Text className="text-2xl font-bold text-primary">
                  {getInitials(displayName)}
                </Text>
              </View>
              <Text className="text-xs text-[#7a7670] mt-2 font-semibold">Avatar representation based on name initials</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

interface VehicleSetupProps {
  vehicleNickname: string;
  setVehicleNickname: (n: string) => void;
  vehicleType: string;
  setVehicleType: (t: string) => void;
  vehicleMake: string;
  setVehicleMake: (m: string) => void;
  vehicleModel: string;
  setVehicleModel: (m: string) => void;
  vehicleYear: string;
  setVehicleYear: (y: string) => void;

  addSecondVehicle: boolean;
  setAddSecondVehicle: (v: boolean) => void;
  vehicle2Nickname: string;
  setVehicle2Nickname: (n: string) => void;
  vehicle2Type: string;
  setVehicle2Type: (t: string) => void;
  vehicle2Make: string;
  setVehicle2Make: (m: string) => void;
  vehicle2Model: string;
  setVehicle2Model: (m: string) => void;
  vehicle2Year: string;
  setVehicle2Year: (y: string) => void;
}

export function VehicleSetupStep({
  vehicleNickname,
  setVehicleNickname,
  vehicleType,
  setVehicleType,
  vehicleMake,
  setVehicleMake,
  vehicleModel,
  setVehicleModel,
  vehicleYear,
  setVehicleYear,

  addSecondVehicle,
  setAddSecondVehicle,
  vehicle2Nickname,
  setVehicle2Nickname,
  vehicle2Type,
  setVehicle2Type,
  vehicle2Make,
  setVehicle2Make,
  vehicle2Model,
  setVehicle2Model,
  vehicle2Year,
  setVehicle2Year,
}: VehicleSetupProps) {
  return (
    <ScrollView className="max-h-96 pr-1">
      <View className="flex flex-col gap-4">
        <View className="gap-1.5">
          <Text className="text-2xl font-bold text-[#f4f2ed]">Primary vehicle</Text>
          <Text className="text-xs text-[#7a7670]">Fuel or EV details unlock smarter cost estimates later.</Text>
        </View>

        <WhyWeAsk 
          summary="Why we ask" 
          body="Vehicle type unlocks the right cost fields when we estimate per-shift expenses." 
        />

        {/* Primary Vehicle Form */}
        <View className="flex flex-col gap-3.5 bg-[#12110f]/40 p-3 rounded-xl border border-[#3d3a35]/40">
          <View className="flex flex-col gap-1.5">
            <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Vehicle Nickname</Text>
            <TextInput
              value={vehicleNickname}
              onChangeText={setVehicleNickname}
              placeholder="e.g. My Prius, E-Bike"
              placeholderTextColor="#7a7670"
              className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
            />
          </View>

          <View className="flex flex-col gap-1.5">
            <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Vehicle Type</Text>
            <View className="flex flex-row flex-wrap gap-1.5">
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg bg-[#1c1b18] border border-[#3d3a35]",
                    vehicleType === v.id && "border-primary bg-primary/10"
                  )}
                >
                  <Text
                    className={cn(
                      "text-[11px] font-semibold",
                      vehicleType === v.id ? "text-primary" : "text-[#b8b4ab]"
                    )}
                  >
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex flex-row gap-3">
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Make</Text>
              <TextInput
                value={vehicleMake}
                onChangeText={setVehicleMake}
                placeholder="Toyota"
                placeholderTextColor="#7a7670"
                className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
              />
            </View>
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Model</Text>
              <TextInput
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="Prius"
                placeholderTextColor="#7a7670"
                className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
              />
            </View>
          </View>

          <View className="flex flex-col gap-1.5">
            <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Year</Text>
            <TextInput
              value={vehicleYear}
              onChangeText={setVehicleYear}
              keyboardType="numeric"
              placeholder="2020"
              placeholderTextColor="#7a7670"
              className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
            />
          </View>
        </View>

        {/* Second Vehicle Toggle */}
        <View className="flex flex-row justify-between items-center p-3 bg-[#1c1b18] border border-[#3d3a35] rounded-xl mt-1">
          <View className="flex-1 pr-3">
            <Text className="font-bold text-[#f4f2ed] text-sm">Add a second vehicle</Text>
            <Text className="text-[10px] text-[#7a7670] mt-0.5">Useful if you switch between car and bike.</Text>
          </View>
          <Switch
            value={addSecondVehicle}
            onValueChange={setAddSecondVehicle}
            trackColor={{ false: "#262522", true: "#10b981" }}
            thumbColor="#f4f2ed"
          />
        </View>

        {/* Second Vehicle Form */}
        {addSecondVehicle && (
          <View className="flex flex-col gap-3.5 bg-[#12110f]/40 p-3 rounded-xl border border-[#3d3a35]/40 mt-1">
            <Text className="text-sm font-bold text-primary">Secondary vehicle details</Text>
            
            <View className="flex flex-col gap-1.5">
              <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Vehicle Nickname</Text>
              <TextInput
                value={vehicle2Nickname}
                onChangeText={setVehicle2Nickname}
                placeholder="e.g. My E-Bike"
                placeholderTextColor="#7a7670"
                className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
              />
            </View>

            <View className="flex flex-col gap-1.5">
              <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Vehicle Type</Text>
              <View className="flex flex-row flex-wrap gap-1.5">
                {VEHICLE_TYPES.map((v) => (
                  <TouchableOpacity
                    key={`v2-${v.id}`}
                    onPress={() => setVehicle2Type(v.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg bg-[#1c1b18] border border-[#3d3a35]",
                      vehicle2Type === v.id && "border-primary bg-primary/10"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[11px] font-semibold",
                        vehicle2Type === v.id ? "text-primary" : "text-[#b8b4ab]"
                      )}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Make</Text>
                <TextInput
                  value={vehicle2Make}
                  onChangeText={setVehicle2Make}
                  placeholder="Specialized"
                  placeholderTextColor="#7a7670"
                  className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
                />
              </View>
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Model</Text>
                <TextInput
                  value={vehicle2Model}
                  onChangeText={setVehicle2Model}
                  placeholder="Turbo Vado"
                  placeholderTextColor="#7a7670"
                  className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
                />
              </View>
            </View>

            <View className="flex flex-col gap-1.5">
              <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Year</Text>
              <TextInput
                value={vehicle2Year}
                onChangeText={setVehicle2Year}
                keyboardType="numeric"
                placeholder="2022"
                placeholderTextColor="#7a7670"
                className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-semibold"
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

interface ScheduleProps {
  workSchedulePreset: "flexible" | "weekdays" | "evenings" | "weekends";
  setWorkSchedulePreset: (p: "flexible" | "weekdays" | "evenings" | "weekends") => void;
}

export function ScheduleStep({ workSchedulePreset, setWorkSchedulePreset }: ScheduleProps) {
  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Typical schedule</Text>
        <Text className="text-xs text-[#7a7670]">Helps with reminders and planning views.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="We schedule gentle reminders around the times you actually drive." 
      />

      <View className="flex flex-col gap-3">
        {SCHEDULE_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setWorkSchedulePreset(p.id as any)}
            className={cn(
              "p-4 rounded-xl bg-[#1c1b18] border border-[#3d3a35] flex flex-row justify-between items-center",
              workSchedulePreset === p.id && "border-primary bg-primary/5"
            )}
          >
            <Text className="font-bold text-[#f4f2ed]">{p.label}</Text>
            {workSchedulePreset === p.id && <View className="w-4 h-4 items-center justify-center"><CheckIcon /></View>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

interface WeeklyGoalProps {
  weeklyGoal: string;
  handleWeeklyGoalChange: (val: string) => void;
}

export function WeeklyGoalStep({ weeklyGoal, handleWeeklyGoalChange }: WeeklyGoalProps) {
  const wNum = Number(weeklyGoal) || 0;
  let motivation = "Every journey starts with a single shift logged.";
  if (wNum >= 800) motivation = "Strong target — we will cheer you on every week. 🏎️";
  else if (wNum >= 400) motivation = "Solid goal — great balance of stretch and realism.";
  else if (wNum >= 200) motivation = "Gentle ramp — you can raise it anytime in Goals.";

  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Weekly earnings goal</Text>
        <Text className="text-xs text-[#7a7670]">We use this for the goal ring and weekly nudges.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="A visible target keeps earnings momentum without judgment." 
      />

      <View className="flex flex-col gap-4">
        <View className="flex flex-row items-center bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-1.5">
          <Text className="text-[#b8b4ab] font-bold text-lg px-3">$</Text>
          <TextInput
            value={weeklyGoal}
            onChangeText={handleWeeklyGoalChange}
            keyboardType="numeric"
            placeholder="500"
            placeholderTextColor="#7a7670"
            className="flex-1 text-[#f4f2ed] font-bold text-xl py-2"
          />
          <Text className="text-[#7a7670] text-xs font-semibold pr-3">/ WEEK</Text>
        </View>
        <Text className="text-primary font-bold text-sm text-center italic px-4">
          "{motivation}"
        </Text>
      </View>
    </View>
  );
}

interface LongTermGoalsProps {
  monthlyGoal: string;
  setMonthlyGoal: (val: string) => void;
  annualGoal: string;
  setAnnualGoal: (val: string) => void;
}

export function LongTermGoalsStep({ monthlyGoal, setMonthlyGoal, annualGoal, setAnnualGoal }: LongTermGoalsProps) {
  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Monthly and annual targets</Text>
        <Text className="text-xs text-[#7a7670]">Prefilled from your weekly goal — adjust freely.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="Longer horizons smooth out slow weeks and busy seasons." 
      />

      <View className="flex flex-col gap-4">
        <View className="flex flex-col gap-1.5">
          <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Monthly target</Text>
          <TextInput
            value={monthlyGoal}
            onChangeText={setMonthlyGoal}
            keyboardType="numeric"
            className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-bold"
          />
        </View>

        <View className="flex flex-col gap-1.5">
          <Text className="text-[#b8b4ab] text-xs font-bold uppercase tracking-wide">Annual target</Text>
          <TextInput
            value={annualGoal}
            onChangeText={setAnnualGoal}
            keyboardType="numeric"
            className="bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-3 text-[#f4f2ed] font-bold"
          />
        </View>
      </View>
    </View>
  );
}

interface TaxWithholdingProps {
  country: "US" | "CA" | "UK";
  taxRegion: string;
  taxWithholdingPct: string;
  setTaxWithholdingPct: (val: string) => void;
}

export function TaxWithholdingStep({ country, taxRegion, taxWithholdingPct, setTaxWithholdingPct }: TaxWithholdingProps) {
  const handleApplyPreset = () => {
    const countryDef = getCountryDef(country);
    const rate = getWithholdingPresetPct(countryDef.tax.regionPresetType, taxRegion) ?? countryDef.tax.defaultWithholdingPct;
    setTaxWithholdingPct(rate.toString());
  };

  const countryName = country === "CA" ? "Canada" : country === "US" ? "USA" : "UK";

  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">Tax set-aside</Text>
        <Text className="text-xs text-[#7a7670]">Rough percentage to set aside from gross for taxes.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="This is guidance only — not tax advice. It powers set-aside reminders." 
      />

      <View className="flex flex-col gap-4">
        <View className="flex flex-row justify-between items-center p-3 bg-[#1c1b18]/60 border border-[#3d3a35]/60 rounded-xl">
          <View>
            <Text className="text-[10px] text-[#7a7670] uppercase font-bold tracking-wide">Current Region</Text>
            <Text className="text-sm font-bold text-[#f4f2ed] mt-0.5">{taxRegion} ({countryName})</Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={handleApplyPreset}
            className="border-[#3d3a35] bg-[#1c1b18] py-2 px-3 rounded-lg"
          >
            <Text className="text-[10px] font-bold text-primary uppercase">Apply region preset</Text>
          </Button>
        </View>

        <View className="flex flex-row items-center bg-[#1c1b18] border border-[#3d3a35] rounded-lg p-1.5">
          <TextInput
            value={taxWithholdingPct}
            onChangeText={setTaxWithholdingPct}
            keyboardType="numeric"
            className="flex-1 text-[#f4f2ed] font-bold text-xl py-2 px-3 text-right"
          />
          <Text className="text-[#b8b4ab] font-bold text-lg px-3">%</Text>
        </View>

        <View className="flex flex-row justify-between pt-1">
          {["15", "20", "25", "30"].map((rate) => (
            <TouchableOpacity
              key={rate}
              onPress={() => setTaxWithholdingPct(rate)}
              className={cn(
                "px-4 py-2 rounded-lg bg-[#1c1b18] border border-[#3d3a35]",
                taxWithholdingPct === rate && "border-primary bg-primary/10"
              )}
            >
              <Text className="text-xs font-bold text-[#b8b4ab]">{rate}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

interface SalesTaxProps {
  country: "US" | "CA" | "UK";
  hstRegistered: boolean;
  setHstRegistered: (v: boolean) => void;
  setStep: (s: number | ((prev: number) => number)) => void;
}

export function SalesTaxStep({ country, hstRegistered, setHstRegistered, setStep }: SalesTaxProps) {
  const countryDef = getCountryDef(country);
  if (!countryDef.tax.hstOnboarding) {
    setTimeout(() => setStep(10), 50);
    return <ActivityIndicator size="small" />;
  }
  return (
    <View className="flex flex-col gap-5">
      <View className="gap-1.5">
        <Text className="text-2xl font-bold text-[#f4f2ed]">GST / HST registration</Text>
        <Text className="text-xs text-[#7a7670]">Canada only — affects HST worksheets later.</Text>
      </View>

      <WhyWeAsk 
        summary="Why we ask" 
        body="Registered collectors have different worksheets than drivers who only earn T4-style income." 
      />

      <View className="p-4 rounded-xl bg-[#1c1b18] border border-[#3d3a35] flex flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-bold text-[#f4f2ed] text-sm">I collect or remit GST / HST</Text>
          <Text className="text-xs text-[#7a7670] mt-1 font-semibold">Standard tax reporting rules will apply for your shifts.</Text>
        </View>
        <Switch
          value={hstRegistered}
          onValueChange={setHstRegistered}
          trackColor={{ false: "#262522", true: "#10b981" }}
          thumbColor="#f4f2ed"
        />
      </View>
    </View>
  );
}

interface CompletionProps {
  displayName: string;
  handleComplete: () => void;
  handleDemoMode: () => void;
  handleExportSetup: () => void;
  handleConnectDrive: () => void;
}

export function CompletionStep({ 
  displayName, 
  handleComplete, 
  handleDemoMode, 
  handleExportSetup, 
  handleConnectDrive 
}: CompletionProps) {
  return (
    <View className="flex flex-col gap-6 items-center justify-center py-6">
      <View className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
        <Text className="text-3xl">🎉</Text>
      </View>
      <View className="items-center gap-1.5">
        <Text className="text-2xl font-extrabold text-[#f4f2ed] text-center tracking-tight">
          Your vault is ready, {displayName || "driver"}
        </Text>
        <Text className="text-xs font-semibold text-[#b8b4ab] text-center">
          Export a tiny setup file, try sample data, or head straight in.
        </Text>
      </View>

      <Text className="text-[#7a7670] text-[10px] text-center leading-relaxed max-w-xs">
        Your profile and vehicle details are stored offline-first in your local secure vault.
      </Text>

      <View className="w-full flex flex-col gap-2.5 mt-3 max-w-sm">
        <Button
          onPress={handleComplete}
          className="bg-primary py-3.5 rounded-xl shadow-lg shadow-primary/20"
        >
          <Text className="font-bold text-white text-sm uppercase">Enter my vault</Text>
        </Button>

        <Button
          onPress={handleConnectDrive}
          variant="outline"
          className="border-[#3d3a35] bg-[#1c1b18] py-3 rounded-xl"
        >
          <Text className="font-semibold text-[#b8b4ab] text-xs uppercase">Connect Google Drive</Text>
        </Button>

        <Button
          onPress={handleExportSetup}
          variant="outline"
          className="border-[#3d3a35] bg-[#1c1b18] py-3 rounded-xl"
        >
          <Text className="font-semibold text-[#b8b4ab] text-xs uppercase">Save setup to file</Text>
        </Button>

        <Button
          onPress={handleDemoMode}
          variant="ghost"
          className="py-2.5 rounded-xl"
        >
          <Text className="font-bold text-primary text-xs uppercase">Load sample demo data</Text>
        </Button>
      </View>
    </View>
  );
}
