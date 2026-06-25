import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Image,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Text } from "@/src/components/ui/text";
import {
  insertExpense,
  updateExpense,
  getExpenseById,
} from "@/src/database/queries/expenses";
import { getVehicles } from "@/src/database/queries/vehicles";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { getExpenseCategories, type ExpenseCategory } from "@/src/registry/expenseCategories";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { cn } from "@/src/lib/utils";
import { type PlatformKey } from "@/src/registry/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";

const isWeb = Platform.OS === "web";

export default function AddExpenseModal() {
  const queryClient = useQueryClient();
  const { expenseId, shiftId: prefillShiftId } = useLocalSearchParams<{
    expenseId?: string;
    shiftId?: string;
  }>();

  const isEditing = !!expenseId;

  // ── Theme State ──────────────────────────────────────────────────────────
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();

  // ── Form State ───────────────────────────────────────────────────────────
  const { profile, loadSettings } = useSettingsStore();
  const country = profile?.country || "CA";
  const customCategories = profile?.customCategories || [];
  const expenseCategories = getExpenseCategories(country, customCategories);

  const [category, setCategory] = useState<string>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [isDeductible, setIsDeductible] = useState(true);
  const [linkedShiftId, setLinkedShiftId] = useState(prefillShiftId || "");
  const [linkedVehicleId, setLinkedVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<"weekly"|"monthly"|"yearly">("monthly");

  // ── UI State ─────────────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [step, setStep] = useState(1);
  const [isNotesFocused, setIsNotesFocused] = useState(false);

  // ── Custom Category State ────────────────────────────────────────────────
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState("🏷️");

  const handleSaveCustomCategory = async () => {
    if (!customName.trim()) {
      Alert.alert("Validation", "Please enter a category name.");
      return;
    }
    if (customCategories.length >= 3) {
      Alert.alert("Limit Reached", "You can add up to 3 custom categories.");
      return;
    }
    
    const newId = `custom_${Date.now()}`;
    const newCat = {
      id: newId,
      label: customName.trim(),
      icon: customEmoji.trim() || "🏷️",
    };

    const updatedProfile = {
      ...profile,
      customCategories: [...customCategories, newCat],
    };

    try {
      if (isWeb) {
        localStorage.setItem("comma_setting_profile", JSON.stringify(updatedProfile));
      } else {
        const { db } = require("@/src/database/client");
        const { settings } = require("@/src/database/schema");
        await db
          .insert(settings)
          .values({ key: "profile", value: JSON.stringify(updatedProfile) })
          .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(updatedProfile) } });
      }

      await loadSettings();
      setCategory(newId);
      setCustomName("");
      setCustomEmoji("🏷️");
      setShowCustomModal(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save custom category.");
    }
  };

  const handleLongPressCategory = (cat: ExpenseCategory) => {
    const isCustom = customCategories.some((c) => c.id === cat.id);
    if (!isCustom) return;

    Alert.alert(
      "Delete Custom Category",
      `Are you sure you want to delete the custom category "${cat.label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedCustom = customCategories.filter((c) => c.id !== cat.id);
            const updatedProfile = {
              ...profile,
              customCategories: updatedCustom,
            };
            
            try {
              if (isWeb) {
                localStorage.setItem("comma_setting_profile", JSON.stringify(updatedProfile));
              } else {
                const { db } = require("@/src/database/client");
                const { settings } = require("@/src/database/schema");
                await db
                  .insert(settings)
                  .values({ key: "profile", value: JSON.stringify(updatedProfile) })
                  .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(updatedProfile) } });
              }
              
              await loadSettings();
              setCategory("fuel");
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to delete custom category.");
            }
          },
        },
      ]
    );
  };

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: existingExpense } = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: () => getExpenseById(expenseId!),
    enabled: isEditing,
  });

  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });

  // Query 1: Shifts near the selected expense date (+/- 7 days)
  const { data: nearShifts = [] } = useQuery({
    queryKey: ["shifts", "near-date", date.toISOString().split("T")[0]],
    queryFn: () => {
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 7);
      endDate.setHours(23, 59, 59, 999);

      return getShiftsPaginated(1, { startDate, endDate });
    },
  });

  // Query 2: Fallback to overall recent shifts in case no shifts are in the window
  const { data: fallbackShifts = [] } = useQuery({
    queryKey: ["shifts", "all-recent"],
    queryFn: () => getShiftsPaginated(1),
  });

  // Use near shifts if available, otherwise fall back to all recent
  const shiftsToShow = nearShifts.length > 0 ? nearShifts : fallbackShifts;

  // Sort them dynamically by absolute distance in time from the selected expense date
  const sortedShifts = React.useMemo(() => {
    if (!shiftsToShow || shiftsToShow.length === 0) return [];
    
    const targetTime = date.getTime();
    return [...shiftsToShow].sort((a, b) => {
      const diffA = Math.abs(new Date(a.startTime).getTime() - targetTime);
      const diffB = Math.abs(new Date(b.startTime).getTime() - targetTime);
      return diffA - diffB;
    });
  }, [shiftsToShow, date]);

  // ── Pre-populate when editing ─────────────────────────────────────────────
  useEffect(() => {
    if (existingExpense) {
      setCategory(existingExpense.category || "fuel");
      setAmount(String(existingExpense.amount || ""));
      setDate(new Date(existingExpense.date));
      setIsDeductible(!!existingExpense.isDeductible);
      setLinkedShiftId(existingExpense.shiftId || "");
      setLinkedVehicleId(existingExpense.vehicleId || "");
      setNotes(existingExpense.notes || "");
      setReceiptUri(existingExpense.receiptUri || null);
      setIsRecurring(!!existingExpense.isRecurring);
      setRecurringInterval(existingExpense.recurringInterval || "monthly");
    }
  }, [existingExpense]);

  // ── Receipt photo picker ──────────────────────────────────────────────────
  const pickReceiptPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length > 0) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert("Error", "Could not open image picker.");
    }
  };

  const takeReceiptPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Camera access is needed to take a receipt photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length > 0) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const handleAddPhoto = () => {
    if (isWeb) {
      pickReceiptPhoto();
      return;
    }
    Alert.alert(
      "Receipt Photo",
      "Choose photo source",
      [
        { text: "Camera", onPress: takeReceiptPhoto },
        { text: "Photo Library", onPress: pickReceiptPhoto },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // ── Save Handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setErrorMessage("");
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid amount greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        category,
        amount: parsedAmount,
        date,
        isDeductible,
        shiftId: linkedShiftId || null,
        vehicleId: linkedVehicleId || null,
        notes: notes.trim() || null,
        receiptUri: receiptUri || null,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
      };

      if (isEditing) {
        await updateExpense(expenseId!, payload);
        queryClient.invalidateQueries({ queryKey: ["expense", expenseId] });
      } else {
        await insertExpense({
          ...payload,
          id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      if (linkedShiftId) {
        queryClient.invalidateQueries({ queryKey: ["shift-expenses", linkedShiftId] });
      }

      router.back();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save expense.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      <Stack.Screen options={{ presentation: "fullScreenModal", headerShown: false }} />
      <View className="flex flex-row items-center px-5 py-4 border-b border-[#1f1f1f] bg-[#0d0d0d]">
        <TouchableOpacity
          onPress={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              router.back();
            }
          }}
          className="p-1 flex-row items-center min-w-[70px]"
        >
          <Text className="text-zinc-400 text-sm font-medium tracking-wide">
            {step > 1 ? "← Back" : "Cancel"}
          </Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white text-base font-bold tracking-tight text-center">
          {isEditing ? "Edit Expense" : "Add Expense"}
        </Text>
        <View className="min-w-[70px]" />
      </View>

      {/* ── Step Indicator ────────────────────────────────────────────── */}
      <View className="px-4 py-3 bg-[#0d0d0d] border-b border-[#1f1f1f] flex-row items-center justify-between">
        <View className="flex-row gap-1.5 items-center">
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                backgroundColor: step >= s ? accentColor : "#262522",
              }}
            />
          ))}
        </View>
        <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">
          Step {step} of 4: {
            step === 1 ? "Amount & Date" :
            step === 2 ? "Category" :
            step === 3 ? "Link Context" :
            "Documentation"
          }
        </Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Error */}
        {errorMessage ? (
          <View className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
            <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        {/* ── STEP 1: AMOUNT & DATE ───────────────────────────────────── */}
        {step === 1 && (
          <View className="flex flex-col gap-5">
            {/* Amount Input */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl py-10 flex flex-col items-center justify-center">
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Expense Amount</Text>
              <View className="flex flex-row items-center justify-center">
                <Text className="text-4xl font-extrabold mr-1.5" style={{ color: accentColor }}>$</Text>
                <TextInput
                  value={amount}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9.]/g, "");
                    const parts = sanitized.split(".");
                    setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#52525b"
                  style={{ fontSize: 44, fontWeight: "900", color: "#ffffff", textAlign: "center", minWidth: 160 }}
                />
              </View>
            </View>

            {/* Date Selection */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-1.5">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Expense Date</Text>
              {isWeb ? (
                <input
                  type="date"
                  value={date.toISOString().substring(0, 10)}
                  onChange={(e) => {
                    if (e.target.value) setDate(new Date(e.target.value + "T12:00:00"));
                  }}
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl p-3.5 text-white text-sm font-semibold outline-none w-full"
                  style={{ outlineColor: accentColor }}
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl px-4 py-3.5 flex-row justify-between items-center"
                >
                  <Text className="text-white text-sm font-semibold">
                    {date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </Text>
                  <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>Change</Text>
                </TouchableOpacity>
              )}
              {showDatePicker && !isWeb && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(_, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            {/* Recurring Expense Toggle */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-3">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Recurring Expense</Text>
                  <Text className="text-zinc-500 text-[10px] mt-0.5">Automatically log this expense</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: "#262522", true: accentColor }}
                  thumbColor="#ffffff"
                />
              </View>
              {isRecurring && (
                <View className="flex-row gap-2 mt-2">
                  {(["weekly", "monthly", "yearly"] as const).map((interval) => (
                    <TouchableOpacity
                      key={interval}
                      onPress={() => setRecurringInterval(interval)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: recurringInterval === interval ? accentColor + "20" : "#0d0d0d",
                        borderWidth: 1,
                        borderColor: recurringInterval === interval ? accentColor : "#262522",
                        alignItems: "center"
                      }}
                    >
                      <Text style={{
                        color: recurringInterval === interval ? accentColor : "#a1a1aa",
                        fontSize: 12,
                        fontWeight: "800",
                        textTransform: "uppercase"
                      }}>
                        {interval}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Next Button */}
            <TouchableOpacity
              onPress={() => {
                const val = parseFloat(amount);
                if (!amount || isNaN(val) || val <= 0) {
                  setErrorMessage("Please enter a valid amount greater than 0.");
                  return;
                }
                setErrorMessage("");
                setStep(2);
              }}
              style={{ backgroundColor: accentColor }}
              className="py-4 rounded-xl items-center mt-2 shadow-lg"
            >
              <Text className="font-bold text-sm" style={{ color: accentColorContrast }}>Next: Choose Category →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: CATEGORY ────────────────────────────────────────── */}
        {step === 2 && (
          <View className="flex flex-col gap-5">
            {/* Category Grid */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-2">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide mb-2">Category Selection</Text>
              <View className="flex flex-row flex-wrap gap-2 justify-start">
                {expenseCategories.map((cat) => {
                  const isSelected = category === cat.id;
                  const isCustom = customCategories.some((c) => c.id === cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategory(cat.id)}
                      onLongPress={() => isCustom && handleLongPressCategory(cat)}
                      style={{
                        width: "31.5%",
                        borderColor: isSelected ? accentColor : "#262522",
                        backgroundColor: isSelected ? accentColorDim : "#0d0d0d",
                      }}
                      className="flex-row items-center gap-1.5 px-2.5 py-2.5 rounded-xl border mb-1"
                    >
                      <Text className="text-base leading-none">{cat.icon}</Text>
                      <Text
                        numberOfLines={1}
                        className="text-[11px] font-bold flex-1"
                        style={{
                          color: isSelected ? accentColor : "#a1a1aa",
                        }}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {customCategories.length < 3 && (
                  <TouchableOpacity
                    onPress={() => setShowCustomModal(true)}
                    style={{
                      width: "31.5%",
                      borderColor: "#262522",
                      backgroundColor: "#0d0d0d",
                    }}
                    className="flex-row items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border border-dashed mb-1"
                  >
                    <Text className="text-sm leading-none">➕</Text>
                    <Text numberOfLines={1} className="text-[11px] font-bold text-zinc-500">
                      + Custom
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-[10px] text-zinc-500 mt-1 italic font-semibold">
                * Long-press a custom category to delete it.
              </Text>
            </View>

            {/* Deductible toggle */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-3">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Tax Deductible</Text>
              <View className="flex-row bg-[#0d0d0d] p-1 rounded-xl border border-[#262522]">
                <TouchableOpacity
                  onPress={() => setIsDeductible(true)}
                  style={{
                    backgroundColor: isDeductible ? accentColorDim : "transparent",
                    borderColor: isDeductible ? accentColorMid : "transparent",
                    borderWidth: 1,
                  }}
                  className="flex-1 py-3 rounded-lg items-center justify-center"
                >
                  <Text
                    style={{ color: isDeductible ? accentColor : "#a1a1aa" }}
                    className="text-xs font-bold"
                  >
                    Yes (Business)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsDeductible(false)}
                  className={cn(
                    "flex-1 py-3 rounded-lg items-center justify-center",
                    !isDeductible ? "bg-rose-500/10 border border-rose-500/20" : "border-transparent"
                  )}
                >
                  <Text className={cn("text-xs font-bold", !isDeductible ? "text-rose-400" : "text-zinc-500")}>
                    No (Personal)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setStep(1)}
                className="flex-1 py-4 bg-[#1f1f1f] border border-[#262522] rounded-xl items-center"
              >
                <Text className="text-zinc-400 font-bold text-sm">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-xl items-center"
              >
                <Text className="font-bold text-sm" style={{ color: accentColorContrast }}>Next: Link Context →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 3: LINK CONTEXT ────────────────────────────────────── */}
        {step === 3 && (
          <View className="flex flex-col gap-5">
            {/* Vehicle Linkage */}
            {vehiclesList.length > 0 && (
              <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-3">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Vehicle Link</Text>
                <View className="flex-row flex-wrap gap-2">
                  {/* None option */}
                  <TouchableOpacity
                    onPress={() => setLinkedVehicleId("")}
                    className="px-3.5 py-2.5 rounded-xl border min-w-[65px] items-center justify-center"
                    style={{
                      borderColor: !linkedVehicleId ? accentColor : "#262522",
                      backgroundColor: !linkedVehicleId ? accentColorDim : "#0d0d0d",
                    }}
                  >
                    <Text
                      style={{ color: !linkedVehicleId ? accentColor : "#a1a1aa" }}
                      className="text-xs font-bold"
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {vehiclesList.map((v: any) => {
                    const isSelected = linkedVehicleId === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setLinkedVehicleId(isSelected ? "" : v.id)}
                        className="px-3.5 py-2.5 rounded-xl border flex-row items-center gap-2 justify-center"
                        style={{
                          borderColor: isSelected ? accentColor : "#262522",
                          backgroundColor: isSelected ? accentColorDim : "#0d0d0d",
                        }}
                      >
                        <Text className="text-xs font-bold" style={{ color: isSelected ? accentColor : "#e4e4e7" }}>
                          {v.name}
                        </Text>
                        <Text className="text-[9px] text-zinc-500 font-semibold">{v.year} {v.make}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Shift Linkage */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-3">
              <View className="flex-row justify-between items-center mb-0.5">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Link to Shift (Recommended)</Text>
                {linkedShiftId ? (
                  <TouchableOpacity onPress={() => setLinkedShiftId("")}>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Clear Selection</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {sortedShifts.length === 0 ? (
                <View className="py-6 border border-dashed border-[#262522] rounded-xl items-center justify-center">
                  <Text className="text-zinc-500 text-xs font-medium text-center px-4">
                    No shifts found near this date (+/- 7 days).
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2 py-1">
                  {sortedShifts.slice(0, 8).map((s) => {
                    const isSelected = linkedShiftId === s.id;
                    const durationHours = (s.durationSeconds / 3600).toFixed(1);
                    const totalRevenue = s.grossRevenue + s.tipsRevenue;
                    const totalMiles = ((s.activeMileage || 0) + (s.deadMileage || 0)).toFixed(0);

                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setLinkedShiftId(isSelected ? "" : s.id)}
                        style={{
                          width: 210,
                          height: 96,
                          borderColor: isSelected ? accentColor : "#262522",
                          backgroundColor: isSelected ? accentColorDim : "#0d0d0d",
                        }}
                        className="p-3.5 rounded-xl border flex flex-col justify-between"
                      >
                        <View className="flex-row items-center justify-between">
                          <PlatformBadge platform={s.platform as PlatformKey} size="sm" />
                          <Text className="text-[10px] text-zinc-500 font-semibold">
                            {new Date(s.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-extrabold text-white">${totalRevenue.toFixed(2)}</Text>
                          <Text className="text-[10px] text-zinc-400 font-bold">
                            {durationHours}h • {totalMiles} {profile.distanceUnit}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Bottom Actions */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setStep(2)}
                className="flex-1 py-4 bg-[#1f1f1f] border border-[#262522] rounded-xl items-center"
              >
                <Text className="text-zinc-400 font-bold text-sm">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(4)}
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-xl items-center"
              >
                <Text className="font-bold text-sm" style={{ color: accentColorContrast }}>Next: Documentation →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 4: DOCUMENTATION ───────────────────────────────────── */}
        {step === 4 && (
          <View className="flex flex-col gap-5">
            {/* Notes & Receipt Upload */}
            <View className="bg-[#161615] border border-[#262522] rounded-2xl p-4 flex flex-col gap-5">
              <View className="flex flex-col gap-1.5">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Details or notes..."
                  placeholderTextColor="#52525b"
                  onFocus={() => setIsNotesFocused(true)}
                  onBlur={() => setIsNotesFocused(false)}
                  className="bg-[#0d0d0d] border rounded-xl px-3.5 py-2.5 text-white text-sm h-[96px] font-semibold text-left align-top leading-relaxed"
                  style={{
                    borderColor: isNotesFocused ? accentColor : "#262522",
                  }}
                />
              </View>

              <View className="flex flex-col gap-2">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Receipt Picture</Text>
                {receiptUri ? (
                  <View className="w-[120px] h-[120px] relative rounded-xl border border-[#262522] overflow-hidden bg-[#0d0d0d]">
                    <Image source={{ uri: receiptUri }} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => setReceiptUri(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 items-center justify-center border border-white/10"
                    >
                      <Text className="text-white text-xs font-bold leading-none">×</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleAddPhoto}
                    className="w-full py-5 border border-dashed border-[#262522] rounded-xl items-center justify-center bg-[#0d0d0d] flex-row gap-2"
                  >
                    <Text className="text-xl">📷</Text>
                    <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Attach Receipt Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setStep(3)}
                className="flex-1 py-4 bg-[#1f1f1f] border border-[#262522] rounded-xl items-center"
              >
                <Text className="text-zinc-400 font-bold text-sm">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-xl items-center justify-center"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text className="font-bold text-sm" style={{ color: accentColorContrast }}>Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Custom Category Add Modal ────────────────────────────────── */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end", alignItems: "center" }}
        >
          <View className="w-full max-w-md bg-[#161615] border-t border-x border-[#262522] rounded-t-3xl p-6 pb-12 flex flex-col gap-5 shadow-2xl">
            <View>
              <Text className="text-white font-extrabold text-lg tracking-tight">Create Custom Category</Text>
              <Text className="text-zinc-500 text-xs mt-1">Add a personalized category (up to 3 total).</Text>
            </View>

            <View className="flex flex-col gap-4">
              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Emoji Icon</Text>
                <TextInput
                  value={customEmoji}
                  onChangeText={setCustomEmoji}
                  placeholder="🏷️"
                  placeholderTextColor="#52525b"
                  maxLength={5}
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl px-4 py-3 text-white text-base font-semibold w-20 text-center"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Category Name</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Car Wash, Detailing"
                  placeholderTextColor="#52525b"
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl px-4 py-3 text-white text-sm font-semibold"
                />
              </View>
            </View>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setShowCustomModal(false)}
                className="flex-1 py-3 bg-[#0d0d0d] border border-[#262522] rounded-xl items-center"
              >
                <Text className="text-zinc-400 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveCustomCategory}
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-3 rounded-xl items-center"
              >
                <Text className="font-bold text-xs" style={{ color: accentColorContrast }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
