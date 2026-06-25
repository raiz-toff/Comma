import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  Trash2,
  Check,
  Droplet,
  Disc,
  AlertCircle,
  Fuel,
  Droplets,
  Wrench,
  Plus,
} from "lucide-react-native";

import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getVehicles, getVehicleStats, updateVehicle, deleteVehicle } from "@/src/database/queries/vehicles";
import { getMaintenanceLogs, insertMaintenanceLog, deleteMaintenanceLog } from "@/src/database/queries/maintenance";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

// ─── Design tokens ──────────────────────────────────────────────────────────

const DS = {
  pageBg: "#000000",
  cardBg: "#0c0c0c",
  cardBorder: "#1e1e1e",
  inputBg: "#161616",
  inputBorder: "#2a2a2a",
  sep: "#1a1a1a",

  brand: "#ffffff",
  brandSurface: "rgba(255, 255, 255, 0.08)",
  brandBorder: "rgba(255, 255, 255, 0.18)",
  brandText: "#ffffff",

  danger: "#f43f5e",
  dangerSurface: "rgba(244,63,94,0.07)",
  dangerBorder: "rgba(244,63,94,0.22)",
  dangerText: "#fb7185",

  textPrimary: "#e8e7e0",
  textSecondary: "#6a6963",
  textMuted: "#38372f",
  textLabel: "#48473f",

  rCard: 18,
  rInput: 11,
  rChip: 8,
  rPill: 20,

  pagePad: 16,
  cardPad: 15,
  rowPad: 13,
} as const;

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

const MAINTENANCE_TYPES = [
  { id: "oil_change", label: "Oil Change" },
  { id: "tire", label: "Tires" },
  { id: "brake", label: "Brakes" },
  { id: "fuel", label: "Fuel" },
  { id: "wash", label: "Wash" },
  { id: "other", label: "Other" },
] as const;

export default function VehicleDetailScreen() {
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile } = useSettingsStore();

  // Edit form state
  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Add maintenance form state
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [mType, setMType] = useState("oil_change");
  const [mCost, setMCost] = useState("");
  const [mOdometer, setMOdometer] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  // Vehicle data
  const { data: vehiclesList = [], isLoading: isLoadingVehicle } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });

  const vehicle = vehiclesList.find((v: any) => v.id === id);

  useEffect(() => {
    if (vehicle) {
      setName(vehicle.name || "");
      setVehicleType(vehicle.type || "gas");
      setMake(vehicle.make || "");
      setModel(vehicle.model || "");
      setYear(vehicle.year ? String(vehicle.year) : "");
      setLicensePlate(vehicle.licensePlate || "");
      setIsActive(vehicle.isActive ?? false);
    }
  }, [vehicle]);

  const { data: stats } = useQuery({
    queryKey: ["vehicle-stats", id],
    queryFn: () => getVehicleStats(id!),
    enabled: !!id,
  });

  const { data: maintenanceLogs = [] } = useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => getMaintenanceLogs(id!),
    enabled: !!id,
  });

  const handleSaveVehicle = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Vehicle name is required.");
      return;
    }
    setIsSavingVehicle(true);
    try {
      await updateVehicle(id!, {
        name: name.trim(),
        type: vehicleType,
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year, 10) : null,
        licensePlate: licensePlate.trim() || null,
        isActive,
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save vehicle.");
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = () => {
    const performDelete = async () => {
      try {
        await deleteVehicle(id!);
        queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        router.back();
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to delete vehicle.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this vehicle? This cannot be undone.")) performDelete();
    } else {
      Alert.alert("Delete Vehicle", "Delete this vehicle? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!mCost || isNaN(parseFloat(mCost))) {
      Alert.alert("Validation", "Please enter a valid cost.");
      return;
    }
    setIsSavingMaintenance(true);
    try {
      await insertMaintenanceLog({
        id: `maint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vehicleId: id!,
        type: mType,
        cost: parseFloat(mCost),
        odometer: mOdometer ? parseFloat(mOdometer) : null,
        date: new Date(),
        notes: mNotes.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["maintenance", id] });
      setMType("oil_change");
      setMCost("");
      setMOdometer("");
      setMNotes("");
      setShowAddMaintenance(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save maintenance log.");
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const handleDeleteMaintenance = (logId: string) => {
    const performDelete = async () => {
      await deleteMaintenanceLog(logId);
      queryClient.invalidateQueries({ queryKey: ["maintenance", id] });
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this log?")) performDelete();
    } else {
      Alert.alert("Delete", "Delete this maintenance log?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const getMaintenanceIcon = (type: string, color = "#f59e0b") => {
    const size = 18;
    switch (type) {
      case "oil_change":
        return <Droplet size={size} color={color} />;
      case "tire":
        return <Disc size={size} color={color} />;
      case "brake":
        return <AlertCircle size={size} color={color} />;
      case "fuel":
        return <Fuel size={size} color={color} />;
      case "wash":
        return <Droplets size={size} color={color} />;
      case "other":
      default:
        return <Wrench size={size} color={color} />;
    }
  };

  if (isLoadingVehicle) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: DS.textSecondary, fontSize: 14, textAlign: "center" }}>Vehicle not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: accentColor, fontSize: 14, fontWeight: "700" }}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Top Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft color={DS.textPrimary} size={20} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle} numberOfLines={1}>{vehicle.name}</Text>
            <Text style={s.headerSub} numberOfLines={1}>
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.type}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsEditing((e) => !e)}
          style={[
            s.saveBtn,
            { backgroundColor: accentColor },
            isEditing && s.saveBtnCancel
          ]}
        >
          <Text style={[s.saveBtnText, isEditing ? { color: DS.dangerText } : { color: accentColorContrast }]}>
            {isEditing ? "Cancel" : "Edit"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Vehicle Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{stats?.totalShifts ?? 0}</Text>
            <Text style={s.statLabel}>Total Shifts</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{(stats?.totalActiveMileage ?? 0).toFixed(1)}</Text>
            <Text style={s.statLabel}>{profile.distanceUnit} Active</Text>
          </View>
        </View>

        {/* Edit / Info Form */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Vehicle Info</Text>

          {/* Name */}
          <View style={s.row}>
            <Text style={s.rowLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholderTextColor={DS.textMuted}
                style={s.input}
              />
            ) : (
              <Text style={s.rowValue}>{vehicle.name}</Text>
            )}
          </View>

          {/* Type */}
          {isEditing && (
            <View style={s.row}>
              <Text style={s.rowLabel}>Type</Text>
              <View style={s.chips}>
                {VEHICLE_TYPES.map((t) => {
                  const on = vehicleType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setVehicleType(t.id)}
                      style={[s.chip, on && { borderColor: accentColorMid, backgroundColor: accentColorDim }]}
                    >
                      <Text style={[s.chipText, on && { color: accentColor }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Make / Model */}
          <View style={s.rowInline}>
            <View style={s.col}>
              <Text style={s.rowLabel}>Make</Text>
              {isEditing ? (
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="Toyota"
                  placeholderTextColor={DS.textMuted}
                  style={s.input}
                />
              ) : (
                <Text style={s.rowValue}>{vehicle.make || "—"}</Text>
              )}
            </View>
            <View style={s.col}>
              <Text style={s.rowLabel}>Model</Text>
              {isEditing ? (
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="Prius"
                  placeholderTextColor={DS.textMuted}
                  style={s.input}
                />
              ) : (
                <Text style={s.rowValue}>{vehicle.model || "—"}</Text>
              )}
            </View>
          </View>

          {/* Year / License */}
          <View style={s.rowInline}>
            <View style={s.col}>
              <Text style={s.rowLabel}>Year</Text>
              {isEditing ? (
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="2021"
                  keyboardType="numeric"
                  placeholderTextColor={DS.textMuted}
                  style={s.input}
                />
              ) : (
                <Text style={s.rowValue}>{vehicle.year || "—"}</Text>
              )}
            </View>
            <View style={s.col}>
              <Text style={s.rowLabel}>License Plate</Text>
              {isEditing ? (
                <TextInput
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                  placeholder="ABC 123"
                  placeholderTextColor={DS.textMuted}
                  style={s.input}
                />
              ) : (
                <Text style={[s.rowValue, vehicle.licensePlate && { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>
                  {vehicle.licensePlate || "—"}
                </Text>
              )}
            </View>
          </View>

          {/* Active Toggle */}
          {isEditing && (
            <View style={s.switchContainer}>
              <Text style={s.switchLabel}>Set as Active Vehicle</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: DS.inputBorder, true: accentColor }}
                thumbColor="#fff"
              />
            </View>
          )}

          {/* Save / Delete vehicle buttons */}
          {isEditing && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleSaveVehicle}
                disabled={isSavingVehicle}
                style={[s.primaryBtn, { backgroundColor: accentColor }]}
              >
                {isSavingVehicle ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text style={[s.primaryBtnText, { color: accentColorContrast }]}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteVehicle}
                style={s.dangerBtn}
              >
                <Text style={s.dangerBtnText}>Delete Vehicle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Maintenance Log Section */}
        <View style={{ gap: 12 }}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>Maintenance Log</Text>
            <TouchableOpacity
              onPress={() => setShowAddMaintenance((v) => !v)}
              style={[
                s.saveBtn,
                { backgroundColor: accentColor },
                showAddMaintenance && s.saveBtnCancel,
                { minWidth: 0, paddingHorizontal: 12, paddingVertical: 6 }
              ]}
            >
              <Text style={[s.saveBtnText, showAddMaintenance ? { color: DS.dangerText } : { color: accentColorContrast }, { fontSize: 10 }]}>
                {showAddMaintenance ? "Cancel" : "+ Add Log"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Maintenance Form */}
          {showAddMaintenance && (
            <View style={s.card}>
              <Text style={[s.cardTitle, { marginBottom: 12 }]}>Add Maintenance Log</Text>
              
              <View style={[s.chips, { marginBottom: 14 }]}>
                {MAINTENANCE_TYPES.map((t) => {
                  const on = mType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setMType(t.id)}
                      style={[s.chip, on && { borderColor: accentColorMid, backgroundColor: accentColorDim }, { flexDirection: "row", alignItems: "center", gap: 6 }]}
                    >
                      {getMaintenanceIcon(t.id, on ? accentColor : DS.textSecondary)}
                      <Text style={[s.chipText, on && { color: accentColor }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.rowInline}>
                <View style={s.col}>
                  <Text style={s.rowLabel}>Cost ($) *</Text>
                  <TextInput
                    value={mCost}
                    onChangeText={setMCost}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
                <View style={s.col}>
                  <Text style={s.rowLabel}>Odometer ({profile.distanceUnit})</Text>
                  <TextInput
                    value={mOdometer}
                    onChangeText={setMOdometer}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor={DS.textMuted}
                    style={s.input}
                  />
                </View>
              </View>

              <View style={s.row}>
                <Text style={s.rowLabel}>Notes</Text>
                <TextInput
                  value={mNotes}
                  onChangeText={setMNotes}
                  multiline
                  numberOfLines={2}
                  placeholder="Notes (oil brand, shop name, etc.)"
                  placeholderTextColor={DS.textMuted}
                  style={[s.input, s.inputMultiline]}
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveMaintenance}
                disabled={isSavingMaintenance}
                style={[s.primaryBtn, { backgroundColor: accentColor }]}
              >
                {isSavingMaintenance ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text style={[s.primaryBtnText, { color: accentColorContrast }]}>Save Log</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Maintenance list */}
          {maintenanceLogs.length === 0 ? (
            <View style={{ paddingVertical: 28, borderWidth: 0.5, borderStyle: "dashed", borderColor: DS.cardBorder, borderRadius: DS.rCard, alignItems: "center", justifyContent: "center", backgroundColor: DS.cardBg }}>
              <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "500" }}>No maintenance logs yet.</Text>
            </View>
          ) : (
            <View style={s.mList}>
              {maintenanceLogs.map((log: any) => (
                <View key={log.id} style={s.mItem}>
                  <View style={s.mIconContainer}>
                    {getMaintenanceIcon(log.type, accentColor)}
                  </View>

                  <View style={s.mInfo}>
                    <View style={s.mNameRow}>
                      <Text style={s.mName}>
                        {MAINTENANCE_TYPES.find((t) => t.id === log.type)?.label || log.type}
                      </Text>
                      <Text style={{ color: DS.dangerText, fontSize: 14, fontWeight: "700" }}>
                        ${log.cost.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={s.mMeta}>
                      {new Date(log.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      {log.odometer ? ` · ${log.odometer} ${profile.distanceUnit}` : ""}
                    </Text>
                    {log.notes ? <Text style={s.mNotes}>{log.notes}</Text> : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteMaintenance(log.id)}
                    style={s.deleteLogBtn}
                  >
                    <Trash2 size={14} color={DS.dangerText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  scroll: { paddingHorizontal: DS.pagePad, paddingBottom: 40 },
  
  // Header
  header: { paddingHorizontal: DS.pagePad, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerTitle: { color: DS.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { color: DS.textSecondary, fontSize: 11, marginTop: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.rPill, backgroundColor: DS.brand, minWidth: 64, alignItems: "center", justifyContent: "center" },
  saveBtnCancel: { backgroundColor: DS.dangerSurface, borderWidth: 0.5, borderColor: DS.dangerBorder },
  saveBtnText: { color: "#000", fontSize: 12, fontWeight: "700" },

  // Stats
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    padding: DS.cardPad,
    alignItems: "center",
  },
  statValue: {
    color: DS.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    color: DS.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Cards
  card: { backgroundColor: DS.cardBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.cardBorder, overflow: "hidden", padding: DS.cardPad, marginBottom: 16 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { color: DS.textPrimary, fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { marginBottom: 14 },
  rowLabel: { color: DS.textSecondary, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  rowValue: { color: DS.textPrimary, fontSize: 15, fontWeight: "600" },
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
  inputMultiline: {
    height: 60,
    textAlignVertical: "top",
  },

  // Toggle switch container
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  switchLabel: { color: DS.textPrimary, fontSize: 14, fontWeight: "600" },

  // Chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.rChip, borderWidth: 0.5, borderColor: DS.inputBorder, backgroundColor: DS.inputBg },
  chipOn: { borderColor: DS.brandBorder, backgroundColor: DS.brandSurface },
  chipText: { fontSize: 11, fontWeight: "600", color: DS.textSecondary },
  chipTextOn: { color: DS.brandText },

  // Buttons
  primaryBtn: {
    backgroundColor: DS.brand,
    borderRadius: DS.rInput,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#000", fontSize: 14, fontWeight: "700" },
  
  dangerBtn: {
    backgroundColor: DS.dangerSurface,
    borderColor: DS.dangerBorder,
    borderWidth: 0.5,
    borderRadius: DS.rInput,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  dangerBtnText: { color: DS.dangerText, fontSize: 14, fontWeight: "700" },

  // Maintenance list
  mList: { gap: 10 },
  mItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    padding: DS.cardPad,
    gap: 12,
  },
  mIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  mInfo: { flex: 1 },
  mNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  mName: { color: DS.textPrimary, fontSize: 14, fontWeight: "700" },
  mCost: { color: DS.textPrimary, fontSize: 14, fontWeight: "700" },
  mMeta: { color: DS.textSecondary, fontSize: 11 },
  mNotes: { color: DS.textSecondary, fontSize: 11, fontStyle: "italic", marginTop: 4 },
  deleteLogBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.dangerSurface,
    borderWidth: 0.5,
    borderColor: DS.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});
