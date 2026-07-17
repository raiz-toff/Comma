import React, { useState } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Car,
  Bike,
  Zap,
  User,
  Check,
} from "lucide-react-native";

import { Text } from "@/src/components/ui/text";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { withAlpha } from "@/src/theme/colors";
import { useThemedStyles, type Palette } from "@/src/theme/useColors";
import { getVehicles, insertVehicle } from "@/src/database/queries/vehicles";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";

// ─── Design tokens ──────────────────────────────────────────────────────────

const makeDS = (C: Palette) =>
  ({
    pageBg: C.background,
    cardBg: C.surface02,
    cardBorder: C.lineSubtle,
    inputBg: C.surface03,
    inputBorder: C.lineStrong,
    sep: C.lineSubtle,

    brand: C.contentPrimary,
    brandSurface: C.surface04,
    brandBorder: C.lineStrong,
    brandText: C.contentPrimary,

    danger: C.destructive,
    dangerSurface: withAlpha(C.destructive, 0.08),
    dangerBorder: withAlpha(C.destructive, 0.18),
    dangerText: C.destructive,

    textPrimary: C.contentPrimary,
    textSecondary: C.contentSecondary,
    textMuted: C.contentMuted,
    textLabel: C.contentMuted,

    rCard: 16,
    rInput: 12,
    rChip: 8,
    rPill: 20,

    pagePad: 16,
    cardPad: 16,
    rowPad: 12,
  }) as const;

const VEHICLE_TYPES = [
  { id: "gas", label: "Gas" },
  { id: "hybrid", label: "Hybrid" },
  { id: "ev", label: "Electric" },
  { id: "motorcycle", label: "Moto" },
  { id: "bicycle", label: "Bicycle" },
  { id: "ebike", label: "E-Bike" },
  { id: "scooter", label: "Scooter" },
  { id: "walking", label: "Walking" },
] as const;

export default function VehiclesScreen() {
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isOnboardingCompleted, isDemoMode } = useSettingsStore();
  const { columnStyle } = useLayout();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: vehiclesList = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
    enabled: isOnboardingCompleted,
  });

  const resetForm = () => {
    setName("");
    setVehicleType("gas");
    setMake("");
    setModel("");
    setYear("");
    setLicensePlate("");
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot add vehicles while Demo Mode is active. Please turn off Demo Mode in Settings to manage your vehicles.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a vehicle name.");
      return;
    }
    setIsSaving(true);
    const isFirstVehicle = vehiclesList.length === 0;
    try {
      await insertVehicle({
        id: `vehicle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        type: vehicleType,
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year, 10) : null,
        fuelType: vehicleType,
        licensePlate: licensePlate.trim() || null,
        isActive: isFirstVehicle,
        createdAt: new Date(),
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save vehicle.");
    } finally {
      setIsSaving(false);
    }
  };

  const getVehicleIcon = (type: string, active: boolean) => {
    const size = 20;
    const color = active ? accentColor : DS.textSecondary;
    switch (type) {
      case "gas":
      case "hybrid":
        return <Car size={size} color={color} />;
      case "ev":
        return <Zap size={size} color={color} />;
      case "motorcycle":
      case "bicycle":
      case "ebike":
      case "scooter":
        return <Bike size={size} color={color} />;
      case "walking":
        return <User size={size} color={color} />;
      default:
        return <Car size={size} color={color} />;
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Top Header — sits outside the ScrollView, so it takes the same cap as the
          content below it. `columnStyle` is undefined on phones. */}
      <View style={[s.header, { paddingTop: insets.top + 10 }, columnStyle]}>
        <View style={s.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={DS.textPrimary} size={20} />
          </TouchableOpacity>
          <View>
            <Text variant="headingM">Vehicles</Text>
            <Text variant="paragraphS" style={s.headerSub}>Manage your fleet</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowAddForm((v) => !v)}
          accessibilityRole="button"
          style={[
            s.saveBtn,
            { backgroundColor: accentColor },
            showAddForm && s.saveBtnCancel
          ]}
        >
          <Text variant="labelM" style={showAddForm ? { color: DS.dangerText } : { color: accentColorContrast }}>
            {showAddForm ? "Cancel" : "+ Add"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, columnStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* Add Vehicle Form */}
          {showAddForm && (
            <Card className="mb-4">
              <Text variant="labelXs" className="mb-3">New Vehicle</Text>

              {/* Name */}
              <View style={s.row}>
                <Text variant="labelXs" style={s.rowLabel}>Name / Nickname *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Prius Prime"
                  placeholderTextColor={DS.textMuted}
                  style={s.input}
                />
              </View>

              {/* Type */}
              <View style={s.row}>
                <Text variant="labelXs" style={s.rowLabel}>Vehicle Type</Text>
                <View style={s.chips}>
                  {VEHICLE_TYPES.map((t) => {
                    const on = vehicleType === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setVehicleType(t.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[s.chip, on && { borderColor: accentColorMid, backgroundColor: accentColorDim }]}
                      >
                        <Text variant="labelM" style={[s.chipText, on && { color: accentColor }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Make / Model */}
              <View style={s.rowInline}>
                <View style={s.col}>
                  <Text variant="labelXs" style={s.rowLabel}>Make</Text>
                  <TextInput
                    value={make}
                    onChangeText={setMake}
                    placeholder="Toyota"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
                <View style={s.col}>
                  <Text variant="labelXs" style={s.rowLabel}>Model</Text>
                  <TextInput
                    value={model}
                    onChangeText={setModel}
                    placeholder="Prius"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
              </View>

              {/* Year / License */}
              <View style={s.rowInline}>
                <View style={s.col}>
                  <Text variant="labelXs" style={s.rowLabel}>Year</Text>
                  <TextInput
                    value={year}
                    onChangeText={setYear}
                    placeholder="2021"
                    keyboardType="numeric"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
                <View style={s.col}>
                  <Text variant="labelXs" style={s.rowLabel}>License Plate</Text>
                  <TextInput
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    placeholder="ABC 123"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
                style={[s.actionBtn, { backgroundColor: accentColor }]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <>
                    <Plus size={16} color={accentColorContrast} />
                    <Text variant="labelM" style={{ color: accentColorContrast }}>Save Vehicle</Text>
                  </>
                )}
              </TouchableOpacity>
            </Card>
          )}

          {/* Vehicle List */}
          {isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          ) : vehiclesList.length === 0 ? (
            <View style={{ paddingVertical: 24 }}>
              <EmptyState
                icon="car"
                title="No Vehicles"
                message="Add your first vehicle to track mileage and expenses."
                actionLabel="Add Vehicle"
                onAction={() => setShowAddForm(true)}
              />
            </View>
          ) : (
            <View style={s.vehicleList}>
              {vehiclesList.map((v: any) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => router.push(`/vehicles/${v.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.name}${v.isActive ? ", active vehicle" : ""}. View details`}
                  style={[s.vehicleItem, v.isActive && { borderColor: accentColorMid }]}
                >
                  {/* Icon area */}
                  <View style={[s.iconContainer, v.isActive && { backgroundColor: accentColorDim, borderColor: accentColorMid }]}>
                    {getVehicleIcon(v.type, v.isActive)}
                  </View>

                  {/* Info */}
                  <View style={s.vehicleInfo}>
                    <View style={s.vehicleNameRow}>
                      <Text variant="labelL">{v.name}</Text>
                      {v.isActive && (
                        <View style={[s.activeBadge, { backgroundColor: accentColorDim, borderColor: accentColorMid }]}>
                          <Text variant="labelXs" style={{ color: accentColor }}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text variant="paragraphS" style={s.vehicleMeta}>
                      {[v.year, v.make, v.model].filter(Boolean).join(" ") || v.type}
                    </Text>
                    {v.licensePlate && (
                      <Text variant="labelXs" tabular style={s.vehiclePlate}>{v.licensePlate.toUpperCase()}</Text>
                    )}
                  </View>

                  {/* Chevron */}
                  <ChevronRight size={18} color={DS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) => {
  const DS = makeDS(C);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  scroll: { paddingHorizontal: DS.pagePad, paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: DS.pagePad, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerSub: { color: DS.textSecondary, marginTop: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.rPill, backgroundColor: DS.brand, minWidth: 64, alignItems: "center", justifyContent: "center" },
  saveBtnCancel: { backgroundColor: DS.dangerSurface, borderWidth: 0.5, borderColor: DS.dangerBorder },

  // Row
  row: { marginBottom: 14 },
  rowLabel: { color: DS.textSecondary, marginBottom: 6 },
  rowInline: { flexDirection: "row", gap: 12, marginBottom: 14 },
  col: { flex: 1 },

  // Inputs
  input: {
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    color: DS.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.rChip, borderWidth: 0.5, borderColor: DS.inputBorder, backgroundColor: DS.inputBg },
  chipOn: { borderColor: DS.brandBorder, backgroundColor: DS.brandSurface },
  chipText: { color: DS.textSecondary },
  chipTextOn: { color: DS.brandText },

  // Action button
  actionBtn: {
    backgroundColor: DS.brand,
    borderRadius: DS.rInput,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  // Vehicle List
  vehicleList: { gap: 10 },
  vehicleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    padding: DS.cardPad,
    gap: 12,
  },
  vehicleItemActive: {
    borderColor: DS.brandBorder,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerActive: {
    backgroundColor: DS.brandSurface,
    borderColor: DS.brandBorder,
  },
  vehicleInfo: { flex: 1 },
  vehicleNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: DS.brandSurface,
    borderWidth: 0.5,
    borderColor: DS.brandBorder,
    borderRadius: 8,
  },
  vehicleMeta: { color: DS.textSecondary },
  vehiclePlate: { color: DS.textSecondary, marginTop: 2 },
  });
};
