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
import {
  Truck,
  Briefcase,
  Wrench,
  MapPin,
  Car,
  Bike,
  Zap,
  Check,
  MapPinned,
  Navigation,
} from "lucide-react-native";

type WorkType = "delivery" | "business" | "contractor" | "mileage";

// ─── Shared primitives ────────────────────────────────────────────────────────

function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 28 }}>
      <Text style={s.heading}>{title}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
    </View>
  );
}

function OptionTile({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.tile, selected && s.tileSelected]}
    >
      {children}
      {selected && (
        <View style={s.checkBadge}>
          <Check size={10} color="#000" strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={s.fieldLabel}>{label}</Text>
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
  onDevDemo,
}: {
  onStart: () => void;
  onDemo: () => void;
  onDevDemo?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingHorizontal: 28, paddingVertical: 32 }}>

        {/* Logo */}
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color: "#000000" }}>C</Text>
          </View>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff", letterSpacing: 2.5, textTransform: "uppercase", marginTop: 14 }}>
            COMMA
          </Text>
        </View>

        {/* Hero */}
        <View style={{ alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 38, fontWeight: "800", color: "#f4f2ed", textAlign: "center", letterSpacing: -0.5, lineHeight: 46 }}>
            Stop guessing{"\n"}what you made.
          </Text>
          <Text style={{ fontSize: 15, color: "#7a7670", textAlign: "center", lineHeight: 24, maxWidth: 260 }}>
            Every dollar earned. Every mile driven. Every deduction tracked — all on your device.
          </Text>
        </View>

        {/* CTAs */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={onStart}
            style={{ backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 17, alignItems: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#000000", letterSpacing: 0.2 }}>
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

          {onDevDemo && (
            <Pressable
              onPress={onDevDemo}
              style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#3f3f46" }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ffffff" }}>
                🛠️ Try GPS Engine Demo
              </Text>
            </Pressable>
          )}

          <Text style={{ fontSize: 11, color: "#52525b", textAlign: "center", fontWeight: "600", letterSpacing: 0.3, marginTop: 4 }}>
            No account required · No data leaves your device
          </Text>
        </View>

      </View>
    </View>
  );
}

// ─── Step 0 — Persona ─────────────────────────────────────────────────────────

const PERSONA_OPTIONS: {
  value: WorkType;
  label: string;
  sub: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}[] = [
  { value: "delivery", label: "Delivery & Rideshare", sub: "DoorDash, Uber, Skip, Lyft", Icon: Truck },
  { value: "business", label: "Business driving", sub: "Sales, real estate, consulting", Icon: Briefcase },
  { value: "contractor", label: "Contracting", sub: "Trades, freelance, field work", Icon: Wrench },
  { value: "mileage", label: "Mileage tracking only", sub: "Reimbursement or personal records", Icon: MapPin },
];

export function PersonaStep({
  value,
  onChange,
}: {
  value: WorkType;
  onChange: (v: WorkType) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title="What kind of work do you do?"
        sub="We'll build your dashboard around how you actually work."
      />
      <View style={{ gap: 10 }}>
        {PERSONA_OPTIONS.map(({ value: v, label, sub, Icon }) => {
          const selected = value === v;
          return (
            <OptionTile key={v} selected={selected} onPress={() => onChange(v)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                <View style={[s.iconBox, selected && s.iconBoxSelected]}>
                  <Icon size={18} color={selected ? "#ffffff" : "#7a7670"} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{label}</Text>
                  <Text style={s.tileSub}>{sub}</Text>
                </View>
              </View>
            </OptionTile>
          );
        })}
      </View>
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
              style={[
                s.countryTile,
                selected && s.tileSelected,
              ]}
            >
              <Text style={{ fontSize: 28 }}>{flag}</Text>
              <Text style={[s.tileTitle, { textAlign: "center" }, selected && { color: "#f4f2ed" }]}>
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

// ─── Step 2 — Region ─────────────────────────────────────────────────────────

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
  const label = country === "CA" ? "Province or territory" : country === "US" ? "State" : "Region";

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title={label}
        sub="Used for regional tax presets and mileage rates."
      />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6 }}>
          {regions.map((r) => {
            const selected = value === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => onChange(r.id)}
                style={[
                  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: selected ? "rgba(255,255,255,0.05)" : "#0d0d0d", borderWidth: 1, borderColor: selected ? "#ffffff" : "#1f1f1f" },
                ]}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: selected ? "#f4f2ed" : "#c8c4bb" }}>
                  {r.label}
                </Text>
                {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Step 3 — Branch ─────────────────────────────────────────────────────────

const BUSINESS_TYPES = ["Real estate", "Sales", "Consulting", "Field service", "Other"];
const CLIENT_TYPES = [
  { id: "one", label: "One main client" },
  { id: "multiple", label: "Multiple clients" },
  { id: "own", label: "My own business" },
];

export function BranchStep({
  workType,
  country,
  selectedPlatforms,
  togglePlatform,
  businessType,
  setBusinessType,
  clientType,
  setClientType,
}: {
  workType: WorkType;
  country: string;
  selectedPlatforms: string[];
  togglePlatform: (id: string) => void;
  businessType: string;
  setBusinessType: (v: string) => void;
  clientType: string;
  setClientType: (v: string) => void;
}) {
  if (workType === "delivery") {
    const platforms = getPlatformsByCountry(country);
    return (
      <View style={{ flex: 1 }}>
        <StepHeading
          title="Which platforms do you use?"
          sub="Select all that apply. You can change this anytime."
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                    <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{p.label}</Text>
                  </View>
                  {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (workType === "business") {
    return (
      <View style={{ flex: 1 }}>
        <StepHeading
          title="What's your primary business type?"
          sub="Helps us label your trips correctly."
        />
        <View style={{ gap: 8 }}>
          {BUSINESS_TYPES.map((bt) => {
            const selected = businessType === bt;
            return (
              <Pressable
                key={bt}
                onPress={() => setBusinessType(bt)}
                style={[s.tile, selected && s.tileSelected]}
              >
                <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{bt}</Text>
                {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (workType === "contractor") {
    return (
      <View style={{ flex: 1 }}>
        <StepHeading
          title="How do you work?"
          sub="We'll set up your client and job tracking accordingly."
        />
        <View style={{ gap: 8 }}>
          {CLIENT_TYPES.map((ct) => {
            const selected = clientType === ct.id;
            return (
              <Pressable
                key={ct.id}
                onPress={() => setClientType(ct.id)}
                style={[s.tile, selected && s.tileSelected]}
              >
                <Text style={[s.tileTitle, selected && { color: "#f4f2ed" }]}>{ct.label}</Text>
                {selected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return null;
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
  nickname, setNickname,
  type, setType,
  make, setMake,
  model, setModel,
  year, setYear,
}: {
  nickname: string; setNickname: (v: string) => void;
  type: string; setType: (v: string) => void;
  make: string; setMake: (v: string) => void;
  model: string; setModel: (v: string) => void;
  year: string; setYear: (v: string) => void;
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
                  <Icon size={14} color={selected ? "#ffffff" : "#7a7670"} strokeWidth={2} />
                  <Text style={[s.chipText, selected && { color: "#ffffff" }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <FieldLabel label="Make" />
            <StyledInput value={make} onChangeText={setMake} placeholder="Toyota" />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <FieldLabel label="Model" />
            <StyledInput value={model} onChangeText={setModel} placeholder="Prius" />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <FieldLabel label="Year (optional)" />
          <StyledInput value={year} onChangeText={setYear} placeholder="2020" keyboardType="numeric" />
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
  workType,
}: {
  value: string;
  onChange: (v: string) => void;
  country: string;
  workType?: WorkType;
}) {
  const num = Number(value) || 0;
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";
  const distanceUnit = country === "US" || country === "UK" ? "mi" : "km";
  const isMileage = workType === "mileage";

  const targetSymbol = isMileage ? ` ${distanceUnit}` : "";
  const prefixSymbol = isMileage ? "" : currencySymbol;
  const pct = Math.min((num / (isMileage ? 500 : 1000)) * 100, 100);

  return (
    <View style={{ flex: 1 }}>
      <StepHeading
        title={isMileage ? "What is your weekly mileage goal?" : "What would a great week look like?"}
        sub={isMileage ? "Sets your weekly distance target. You can change this anytime." : "Sets your weekly earnings target. You can change this anytime."}
      />
      <View style={{ gap: 24 }}>
        <StyledInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          prefix={prefixSymbol}
          suffix={isMileage ? `${distanceUnit} / week` : "/ week"}
          placeholder={isMileage ? "100" : "500"}
        />

        {/* Visual bar */}
        <View style={{ gap: 8 }}>
          <View style={{ height: 6, backgroundColor: "#262522", borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: 6, backgroundColor: "#ffffff", borderRadius: 3, width: `${pct}%` }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10, color: "#52525b", fontWeight: "600" }}>0{targetSymbol}</Text>
            <Text style={{ fontSize: 10, color: "#52525b", fontWeight: "600" }}>{isMileage ? `500${targetSymbol}` : `${currencySymbol}1,000`}</Text>
          </View>
        </View>

        {num > 0 && !isMileage && (
          <View style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#1f1f1f", borderRadius: 14, padding: 16, gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#7a7670", textTransform: "uppercase", letterSpacing: 1 }}>
              That works out to
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#f4f2ed" }}>
              {currencySymbol}{Math.round(num * 4.33).toLocaleString()} / month
            </Text>
            <Text style={{ fontSize: 13, color: "#7a7670" }}>
              {currencySymbol}{(num * 52).toLocaleString()} / year
            </Text>
          </View>
        )}

        {num > 0 && isMileage && (
          <View style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#1f1f1f", borderRadius: 14, padding: 16, gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#7a7670", textTransform: "uppercase", letterSpacing: 1 }}>
              Distance Projection
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#f4f2ed" }}>
              {Math.round(num * 4.33).toLocaleString()} {distanceUnit} / month
            </Text>
            <Text style={{ fontSize: 13, color: "#7a7670" }}>
              {(num * 52).toLocaleString()} {distanceUnit} / year
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Step 6 — Name ────────────────────────────────────────────────────────────

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

// ─── Step 7 — GPS permission ──────────────────────────────────────────────────

export function GPSStep({ workType, onNext }: { workType: WorkType; onNext: () => void }) {
  const [requested, setRequested] = useState(false);

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
    setRequested(true);
    onNext();
  };

  const points = {
    delivery: [
      "Mileage logged automatically during active shifts",
      "Separates active delivery miles from dead miles",
      "All location data stays 100% on your device",
    ],
    business: [
      "Mileage logged automatically during business drives",
      "Classify trips as business or personal with one tap",
      "All location data stays 100% on your device",
    ],
    contractor: [
      "Mileage tracked automatically between job sites",
      "Easily allocate travel expenses to specific clients",
      "All location data stays 100% on your device",
    ],
    mileage: [
      "Track every mile driven automatically in the background",
      "Generate detailed logs ready for tax or reimbursement",
      "All location data stays 100% on your device",
    ],
  }[workType] ?? [
    "Mileage logged automatically during drives",
    "All location data stays 100% on your device",
  ];

  return (
    <View style={{ flex: 1, justifyContent: "space-between" }}>
      <View>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
          <Navigation size={28} color="#ffffff" strokeWidth={1.5} />
        </View>
        <StepHeading
          title="Automatic mileage tracking"
          sub="Comma tracks your mileage in the background while you drive — so you never have to log it manually."
        />
        <View style={{ gap: 12 }}>
          {points.map((point) => (
            <View key={point} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Check size={10} color="#ffffff" strokeWidth={3} />
              </View>
              <Text style={{ fontSize: 14, color: "#c8c4bb", flex: 1, lineHeight: 20 }}>{point}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          onPress={handleRequest}
          style={{ backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 17, alignItems: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#000000" }}>
            Enable GPS tracking
          </Text>
        </Pressable>
        <Pressable onPress={onNext} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#7a7670" }}>
            Skip — I'll enter mileage manually
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Reveal screen ────────────────────────────────────────────────────────────

export function RevealStep({
  displayName,
  workType,
  selectedPlatforms,
  businessType,
  country,
  weeklyGoal,
  onEnter,
}: {
  displayName: string;
  workType: WorkType;
  selectedPlatforms: string[];
  businessType: string;
  country: string;
  weeklyGoal: string;
  onEnter: () => void;
}) {
  const insets = useSafeAreaInsets();
  const currencySymbol = country === "UK" ? "£" : country === "NP" ? "₨" : "$";
  const distanceUnit = country === "US" || country === "UK" ? "miles" : "km";

  const personaLabel = {
    delivery: "Delivery & Rideshare",
    business: "Business driver",
    contractor: "Contractor",
    mileage: "Mileage tracker",
  }[workType];

  return (
    <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 32 }}>

        {/* Success mark */}
        <View style={{ alignItems: "center", gap: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", alignItems: "center", justifyContent: "center" }}>
            <Check size={28} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#f4f2ed", textAlign: "center", letterSpacing: -0.3 }}>
              Your setup is ready{displayName ? `, ${displayName}` : ""}
            </Text>
            <Text style={{ fontSize: 14, color: "#7a7670", textAlign: "center" }}>
              Start your first shift to see your numbers come alive.
            </Text>
          </View>
        </View>

        {/* Summary card */}
        <View style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#1f1f1f", borderRadius: 20, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#7a7670", textTransform: "uppercase", letterSpacing: 1 }}>Your profile</Text>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: "#7a7670" }}>Work type</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#f4f2ed" }}>{personaLabel}</Text>
            </View>

            {workType === "delivery" && selectedPlatforms.length > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, color: "#7a7670" }}>Platforms</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: "60%", justifyContent: "flex-end" }}>
                  {selectedPlatforms.slice(0, 4).map((pid) => {
                    const p = PLATFORMS[pid];
                    return (
                      <View key={pid} style={{ backgroundColor: p?.color ?? "#27272a", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: p?.textColor ?? "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {p?.label ?? pid}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: "#7a7670" }}>Distance unit</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#f4f2ed" }}>{distanceUnit}</Text>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: "#7a7670" }}>Weekly goal</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>
                {currencySymbol}{Number(weeklyGoal).toLocaleString()} / week
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          onPress={onEnter}
          style={{ backgroundColor: "#ffffff", borderRadius: 16, paddingVertical: 17, alignItems: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#000000" }}>
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
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
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
