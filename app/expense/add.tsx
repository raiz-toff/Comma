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
import { DatePickerModal } from "@/src/components/ui/DatePickerModal";
import { Text } from "@/src/components/ui/text";
import {
  insertExpense,
  updateExpense,
  getExpenseById,
  getRecentMerchants,
} from "@/src/database/queries/expenses";
import { getVehicles } from "@/src/database/queries/vehicles";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { getExpenseCategories, getCategoryMeta, getCategoryDefaultPct, type ExpenseCategory } from "@/src/registry/expenseCategories";
import { ExpenseCategoryIcon } from "@/src/components/ui/ExpenseCategoryIcon";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { COLORS, withAlpha } from "@/src/theme/colors";
import { cn } from "@/src/lib/utils";
import { type PlatformKey } from "@/src/registry/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";

import { getTaxProfileForVehicleYear } from "@/src/database/queries/taxProfiles";

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
  const { profile, loadSettings, isDemoMode } = useSettingsStore();
  const country = profile?.country || "CA";
  const customCategories = profile?.customCategories || [];
  const expenseCategories = getExpenseCategories(country, customCategories);

  const [category, setCategory] = useState<string>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [isDeductible, setIsDeductible] = useState(true);
  const [deductiblePct, setDeductiblePct] = useState<number>(100);
  const [linkedShiftId, setLinkedShiftId] = useState(prefillShiftId || "");
  const [linkedVehicleId, setLinkedVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<"weekly"|"monthly"|"yearly">("monthly");
  const [merchant, setMerchant] = useState("");
  const [isMerchantFocused, setIsMerchantFocused] = useState(false);
  const [isScanningOCR, setIsScanningOCR] = useState(false);

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
      setMerchant(existingExpense.merchant || "");
      setDeductiblePct(existingExpense.deductiblePct ?? 100);
    }
  }, [existingExpense]);

  const { data: recentMerchants = [] } = useQuery({
    queryKey: ["recentMerchants"],
    queryFn: () => getRecentMerchants(),
  });

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
  const handleSimulateOCR = () => {
    setIsScanningOCR(true);
    setTimeout(() => {
      setIsScanningOCR(false);
      
      const mockMerchant = "Shell Oil";
      const mockAmount = "45.20";
      
      setMerchant(mockMerchant);
      setAmount(mockAmount);
      
      Alert.alert(
        "Receipt Scanned",
        `Successfully extracted details from receipt:\n\nMerchant: ${mockMerchant}\nAmount: $${mockAmount}\n\nWe have updated the form fields. Please review them in Step 1.`,
        [
          {
            text: "Review Now",
            onPress: () => setStep(1),
          }
        ]
      );
    }, 1500);
  };

  // ── Save Handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot add or edit expenses while Demo Mode is active. Please turn off Demo Mode in Settings to manage your expenses.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    setErrorMessage("");
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid amount greater than 0.");
      return;
    }

    setIsSaving(true);

    const proceedSave = async () => {
      try {
        const payload = {
          category,
          amount: parsedAmount,
          date,
          isDeductible,
          deductiblePct: isDeductible ? Math.min(100, Math.max(0, deductiblePct)) : 100,
          shiftId: linkedShiftId || null,
          vehicleId: linkedVehicleId || null,
          notes: notes.trim() || null,
          receiptUri: receiptUri || null,
          isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
          merchant: merchant.trim(),
          merchantNormalized: merchant.trim().toUpperCase(),
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

    const vehicleCostCategories = ["fuel", "maintenance", "insurance", "depreciation", "parts", "tires"];
    if (linkedVehicleId && vehicleCostCategories.includes(category)) {
      const year = date.getFullYear();
      try {
        const taxProfile = await getTaxProfileForVehicleYear(linkedVehicleId, year);
        if (taxProfile && taxProfile.deductionMethod === "standard_mileage") {
          Alert.alert(
            "Standard Mileage Guardrail",
            `You are claiming standard mileage for ${year}. Vehicle maintenance costs (like ${category}) cannot be written off separately under this method. Do you still want to save this for your personal records?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => setIsSaving(false) },
              { text: "Save Anyway", onPress: () => proceedSave() }
            ]
          );
          return;
        }
      } catch (err) {
        console.error("Failed to query vehicle tax profile:", err);
      }
    }

    await proceedSave();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ presentation: "fullScreenModal", headerShown: false }} />
      <View className="flex flex-row items-center px-5 py-4 border-b border-line-subtle bg-surface-02">
        <TouchableOpacity
          onPress={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              router.back();
            }
          }}
          accessibilityRole="button"
          className="p-1 flex-row items-center min-w-[70px]"
        >
          <Text variant="labelM" className="text-content-secondary tracking-wide">
            {step > 1 ? "← Back" : "Cancel"}
          </Text>
        </TouchableOpacity>
        <Text variant="headingS" className="flex-1 text-center">
          {isEditing ? "Edit Expense" : "Add Expense"}
        </Text>
        <View className="min-w-[70px]" />
      </View>

      {/* ── Step Indicator ────────────────────────────────────────────── */}
      <View className="px-4 py-3 bg-surface-02 border-b border-line-subtle flex-row items-center justify-between">
        <View className="flex-row gap-1.5 items-center">
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                backgroundColor: step >= s ? accentColor : COLORS.surface04,
              }}
            />
          ))}
        </View>
        <Text variant="labelXs" tabular className="text-content-secondary">
          Step {step} of 4: {
            step === 1 ? "Amount & Date" :
            step === 2 ? "Category" :
            step === 3 ? "Link Context" :
            "Documentation"
          }
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Error */}
        {errorMessage ? (
          <View className="bg-destructive/10 border border-destructive/20 p-4 rounded-md">
            <Text variant="paragraphS" className="text-destructive">{errorMessage}</Text>
          </View>
        ) : null}

        {/* ── STEP 1: AMOUNT & DATE ───────────────────────────────────── */}
        {step === 1 && (
          <View className="flex flex-col gap-5">
            {/* Amount Input */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg py-10 flex flex-col items-center justify-center">
              <Text variant="labelXs" className="text-content-secondary mb-2">Expense Amount</Text>
              <View className="flex flex-row items-center justify-center">
                <Text style={{ fontSize: 44, fontWeight: "800", color: accentColor, marginRight: 6, lineHeight: 52, includeFontPadding: false }}>$</Text>
                <TextInput
                  value={amount}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9.]/g, "");
                    const parts = sanitized.split(".");
                    setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.contentMuted}
                  style={{ fontSize: 44, fontWeight: "900", color: COLORS.contentPrimary, textAlign: "center", minWidth: 160, fontVariant: ["tabular-nums"] }}
                />
              </View>
            </View>

            {/* Date Selection */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-1.5">
              <Text variant="labelXs" className="text-content-secondary">Expense Date</Text>
              {isWeb ? (
                <input
                  type="date"
                  value={date.toISOString().substring(0, 10)}
                  onChange={(e) => {
                    if (e.target.value) setDate(new Date(e.target.value + "T12:00:00"));
                  }}
                  className="bg-surface-02 border border-line-subtle rounded-md p-4 text-content-primary text-sm font-semibold outline-none w-full"
                  style={{ outlineColor: accentColor }}
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  className="bg-surface-02 border border-line-subtle rounded-md px-4 py-4 flex-row justify-between items-center"
                >
                  <Text variant="labelM">
                    {date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </Text>
                  <Text variant="labelXs" style={{ color: accentColor }}>Change</Text>
                </TouchableOpacity>
              )}
              {!isWeb && (
                <DatePickerModal
                  visible={showDatePicker}
                  value={date}
                  onChange={setDate}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </View>

            {/* Merchant Autocomplete Card */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-2" style={{ zIndex: 1000 }}>
              <Text variant="labelXs" className="text-content-secondary">Merchant / Vendor</Text>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                onFocus={() => setIsMerchantFocused(true)}
                onBlur={() => setTimeout(() => setIsMerchantFocused(false), 150)}
                placeholder="e.g. Shell, McDonald's, Chevron"
                placeholderTextColor={COLORS.contentMuted}
                returnKeyType="done"
                className="bg-surface-02 border border-line-subtle rounded-md px-4 py-4 text-content-primary text-sm font-semibold focus:border-line-strong"
              />

              {/* Suggestions: show filtered list when typing, or recent 6 on focus with empty field */}
              {(() => {
                const q = merchant.trim().toLowerCase();
                const suggestions: string[] = q.length > 0
                  ? recentMerchants.filter((m: string) => m.toLowerCase().includes(q) && m.toLowerCase() !== q)
                  : isMerchantFocused
                    ? recentMerchants.slice(0, 6)
                    : [];

                if (!isMerchantFocused || suggestions.length === 0) return null;

                return (
                  <View className="bg-surface-02 border border-line-subtle rounded-md overflow-hidden">
                    {q.length === 0 && (
                      <View className="px-4 pt-3 pb-1">
                        <Text variant="labelXs" className="text-content-muted">Recent</Text>
                      </View>
                    )}
                    {suggestions.map((m: string, i: number) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => { setMerchant(m); setIsMerchantFocused(false); }}
                        accessibilityRole="button"
                        className="px-4 py-3 active:bg-surface-04"
                        style={i < suggestions.length - 1 ? { borderBottomWidth: 0.5, borderBottomColor: COLORS.lineSubtle } : undefined}
                      >
                        <Text variant="labelM">{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
            </View>

            {/* Recurring Expense Toggle */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text variant="labelXs" className="text-content-secondary">Recurring Expense</Text>
                  <Text variant="paragraphS" className="text-content-muted mt-0.5">Automatically log this expense</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  accessibilityLabel="Recurring expense"
                  trackColor={{ false: COLORS.surface04, true: accentColor }}
                  thumbColor={COLORS.contentPrimary}
                />
              </View>
              {isRecurring && (
                <View className="flex-row gap-2 mt-2">
                  {(["weekly", "monthly", "yearly"] as const).map((interval) => (
                    <TouchableOpacity
                      key={interval}
                      onPress={() => setRecurringInterval(interval)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: recurringInterval === interval }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: recurringInterval === interval ? accentColorDim : COLORS.surface02,
                        borderWidth: 1,
                        borderColor: recurringInterval === interval ? accentColor : COLORS.lineSubtle,
                        alignItems: "center"
                      }}
                    >
                      <Text variant="labelXs" style={{ color: recurringInterval === interval ? accentColor : COLORS.contentSecondary }}>
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
              accessibilityRole="button"
              style={{ backgroundColor: accentColor }}
              className="py-4 rounded-md items-center mt-2"
            >
              <Text variant="labelM" style={{ color: accentColorContrast }}>Next: Choose Category →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: CATEGORY ────────────────────────────────────────── */}
        {step === 2 && (
          <View className="flex flex-col gap-5">
            {/* Category Grid */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-2">
              <Text variant="labelXs" className="text-content-secondary mb-2">Category Selection</Text>
              <View className="flex flex-row flex-wrap gap-2 justify-start">
                {expenseCategories.map((cat) => {
                  const isSelected = category === cat.id;
                  const isCustom = customCategories.some((c) => c.id === cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => {
                        setCategory(cat.id);
                        const pct = getCategoryDefaultPct(cat.id, country, customCategories);
                        setDeductiblePct(pct);
                      }}
                      onLongPress={() => isCustom && handleLongPressCategory(cat)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        width: "31.5%",
                        borderColor: isSelected ? accentColor : COLORS.lineSubtle,
                        backgroundColor: isSelected ? accentColorDim : COLORS.surface02,
                      }}
                      className="flex-row items-center gap-1.5 px-2.5 py-2.5 rounded-md border mb-1"
                    >
                      <ExpenseCategoryIcon id={cat.id} size={18} color={isSelected ? accentColor : COLORS.contentSecondary} />
                      <Text
                        numberOfLines={1}
                        className="text-[11px] font-bold flex-1"
                        style={{
                          color: isSelected ? accentColor : COLORS.contentSecondary,
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
                    accessibilityRole="button"
                    style={{
                      width: "31.5%",
                      borderColor: COLORS.lineSubtle,
                      backgroundColor: COLORS.surface02,
                    }}
                    className="flex-row items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-md border border-dashed mb-1"
                  >
                    <Text className="text-sm leading-none">➕</Text>
                    <Text numberOfLines={1} className="text-[11px] font-bold text-content-muted">
                      + Custom
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text variant="paragraphS" className="text-content-muted mt-1 italic">
                * Long-press a custom category to delete it.
              </Text>
            </View>

            {/* Deductible toggle */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
              <Text variant="labelXs" className="text-content-secondary">Tax Deductible</Text>
              <View className="flex-row bg-surface-02 p-1 rounded-md border border-line-subtle">
                <TouchableOpacity
                  onPress={() => setIsDeductible(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isDeductible }}
                  style={{
                    backgroundColor: isDeductible ? accentColorDim : "transparent",
                    borderColor: isDeductible ? accentColorMid : "transparent",
                    borderWidth: 1,
                  }}
                  className="flex-1 py-3 rounded-sm items-center justify-center"
                >
                  <Text
                    variant="labelM"
                    style={{ color: isDeductible ? accentColor : COLORS.contentSecondary }}
                  >
                    Yes (Business)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsDeductible(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !isDeductible }}
                  className={cn(
                    "flex-1 py-3 rounded-sm items-center justify-center",
                    !isDeductible ? "bg-destructive/10 border border-destructive/20" : "border-transparent"
                  )}
                >
                  <Text variant="labelM" className={!isDeductible ? "text-destructive" : "text-content-muted"}>
                    No (Personal)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Business use % panel — only shown when deductible */}
            {isDeductible && (() => {
              const meta = getCategoryMeta(category, country, customCategories);
              const parsedAmt = parseFloat(amount);
              const deductibleAmount = !isNaN(parsedAmt) && parsedAmt > 0
                ? (parsedAmt * deductiblePct / 100).toFixed(2)
                : null;
              return (
                <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
                  {/* Tax code hint */}
                  {meta.taxCode && (
                    <View className="flex-row items-center gap-2">
                      <View style={{ backgroundColor: accentColorDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: accentColorMid }}>
                        <Text variant="labelXs" tabular style={{ color: accentColor }}>
                          {meta.taxCode}
                        </Text>
                      </View>
                      <Text variant="paragraphS" className="text-content-secondary flex-1" numberOfLines={2}>
                        {meta.taxCodeLabel}
                      </Text>
                    </View>
                  )}

                  {/* Partial deductibility warning */}
                  {deductiblePct < 100 && (
                    <View style={{ backgroundColor: withAlpha(COLORS.warning, 0.12), borderWidth: 1, borderColor: withAlpha(COLORS.warning, 0.25), borderRadius: 12, padding: 12, flexDirection: "row", gap: 8 }}>
                      <Text style={{ fontSize: 13 }}>⚠️</Text>
                      <Text variant="paragraphS" style={{ color: COLORS.warning, flex: 1 }}>
                        {meta.deductibleNote ?? `This expense is ${deductiblePct}% deductible. Only the deductible portion counts toward your tax summary.`}
                      </Text>
                    </View>
                  )}

                  {/* Business use % label row */}
                  <View className="flex-row justify-between items-center">
                    <Text variant="labelXs" className="text-content-secondary">Business Use %</Text>
                    <Text variant="labelM" tabular style={{ color: accentColor }}>{deductiblePct}%</Text>
                  </View>

                  {/* Quick-pick segments */}
                  <View className="flex-row gap-2">
                    {([25, 50, 75, 100] as const).map((pct) => (
                      <TouchableOpacity
                        key={pct}
                        onPress={() => setDeductiblePct(pct)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: deductiblePct === pct }}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: 12,
                          backgroundColor: deductiblePct === pct ? accentColorDim : COLORS.surface02,
                          borderWidth: 1,
                          borderColor: deductiblePct === pct ? accentColor : COLORS.lineSubtle,
                          alignItems: "center",
                        }}
                      >
                        <Text variant="labelM" tabular style={{ color: deductiblePct === pct ? accentColor : COLORS.contentSecondary }}>
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Freeform % input */}
                  <TextInput
                    value={String(deductiblePct)}
                    onChangeText={(text) => {
                      const parsed = parseInt(text.replace(/[^0-9]/g, ""), 10);
                      if (!isNaN(parsed)) setDeductiblePct(Math.min(100, Math.max(0, parsed)));
                      else if (text === "") setDeductiblePct(0);
                    }}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={COLORS.contentMuted}
                    maxLength={3}
                    style={{
                      backgroundColor: COLORS.surface02,
                      borderWidth: 1,
                      borderColor: COLORS.lineSubtle,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: COLORS.contentPrimary,
                      fontSize: 14,
                      fontWeight: "700",
                      textAlign: "center",
                      fontVariant: ["tabular-nums"],
                    }}
                  />

                  {/* Deductible amount preview */}
                  {deductibleAmount && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.surface02, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lineSubtle }}>
                      <Text variant="labelXs" className="text-content-secondary">Deductible Amount</Text>
                      <Text variant="labelM" tabular className="text-success">${deductibleAmount}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Bottom Actions */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setStep(1)}
                accessibilityRole="button"
                className="flex-1 py-4 bg-surface-04 border border-line-subtle rounded-md items-center"
              >
                <Text variant="labelM" className="text-content-secondary">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                accessibilityRole="button"
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-md items-center"
              >
                <Text variant="labelM" style={{ color: accentColorContrast }}>Next: Link Context →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 3: LINK CONTEXT ────────────────────────────────────── */}
        {step === 3 && (
          <View className="flex flex-col gap-5">
            {/* Vehicle Linkage */}
            {vehiclesList.length > 0 && (
              <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
                <Text variant="labelXs" className="text-content-secondary">Vehicle Link</Text>
                <View className="flex-row flex-wrap gap-2">
                  {/* None option */}
                  <TouchableOpacity
                    onPress={() => setLinkedVehicleId("")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !linkedVehicleId }}
                    className="px-4 py-2.5 rounded-md border min-w-[65px] items-center justify-center"
                    style={{
                      borderColor: !linkedVehicleId ? accentColor : COLORS.lineSubtle,
                      backgroundColor: !linkedVehicleId ? accentColorDim : COLORS.surface02,
                    }}
                  >
                    <Text
                      variant="labelM"
                      style={{ color: !linkedVehicleId ? accentColor : COLORS.contentSecondary }}
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
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className="px-4 py-2.5 rounded-md border flex-row items-center gap-2 justify-center"
                        style={{
                          borderColor: isSelected ? accentColor : COLORS.lineSubtle,
                          backgroundColor: isSelected ? accentColorDim : COLORS.surface02,
                        }}
                      >
                        <Text variant="labelM" style={{ color: isSelected ? accentColor : COLORS.contentPrimary }}>
                          {v.name}
                        </Text>
                        <Text variant="labelXs" tabular className="text-content-muted">{v.year} {v.make}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Shift Linkage */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
              <View className="flex-row justify-between items-center mb-0.5">
                <Text variant="labelXs" className="text-content-secondary">Link to Shift (Recommended)</Text>
                {linkedShiftId ? (
                  <TouchableOpacity onPress={() => setLinkedShiftId("")} accessibilityRole="button">
                    <Text variant="labelXs" className="text-content-muted">Clear Selection</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {sortedShifts.length === 0 ? (
                <View className="py-6 border border-dashed border-line-subtle rounded-md items-center justify-center">
                  <Text variant="paragraphS" className="text-content-muted text-center px-4">
                    No shifts found near this date (+/- 7 days).
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2 py-1">
                  {sortedShifts.slice(0, 8).map((s) => {
                    const isSelected = linkedShiftId === s.id;
                    const durationHours = (s.durationSeconds / 3600).toFixed(1);
                    const totalRevenue = s.grossRevenue + s.tipsRevenue + (s.bonusAmount || 0);
                    const totalMiles = ((s.activeMileage || 0) + (s.deadMileage || 0)).toFixed(0);

                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setLinkedShiftId(isSelected ? "" : s.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={{
                          width: 210,
                          height: 96,
                          borderColor: isSelected ? accentColor : COLORS.lineSubtle,
                          backgroundColor: isSelected ? accentColorDim : COLORS.surface02,
                        }}
                        className="p-4 rounded-md border flex flex-col justify-between"
                      >
                        <View className="flex-row items-center justify-between">
                          <PlatformBadge platform={s.platform as PlatformKey} size="sm" />
                          <Text variant="labelXs" tabular className="text-content-muted">
                            {new Date(s.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                          <Text variant="labelL" tabular>${totalRevenue.toFixed(2)}</Text>
                          <Text variant="labelXs" tabular className="text-content-secondary">
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
                accessibilityRole="button"
                className="flex-1 py-4 bg-surface-04 border border-line-subtle rounded-md items-center"
              >
                <Text variant="labelM" className="text-content-secondary">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(4)}
                accessibilityRole="button"
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-md items-center"
              >
                <Text variant="labelM" style={{ color: accentColorContrast }}>Next: Documentation →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 4: DOCUMENTATION ───────────────────────────────────── */}
        {step === 4 && (
          <View className="flex flex-col gap-5">
            {/* Notes & Receipt Upload */}
            <View className="bg-surface-03 border border-line-subtle rounded-lg p-4 flex flex-col gap-5">
              <View className="flex flex-col gap-1.5">
                <Text variant="labelXs" className="text-content-secondary">Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Details or notes..."
                  placeholderTextColor={COLORS.contentMuted}
                  onFocus={() => setIsNotesFocused(true)}
                  onBlur={() => setIsNotesFocused(false)}
                  className="bg-surface-02 border rounded-md px-4 py-2.5 text-content-primary text-sm h-[96px] font-semibold text-left align-top leading-relaxed"
                  style={{
                    borderColor: isNotesFocused ? accentColor : COLORS.lineSubtle,
                  }}
                />
              </View>

              <View className="flex flex-col gap-2">
                <Text variant="labelXs" className="text-content-secondary">Receipt Picture</Text>
                {receiptUri ? (
                  <View className="flex flex-col gap-3">
                    <View className="w-[120px] h-[120px] relative rounded-md border border-line-subtle overflow-hidden bg-surface-02">
                      <Image source={{ uri: receiptUri }} className="w-full h-full" resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => setReceiptUri(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove receipt photo"
                        hitSlop={10}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full items-center justify-center border border-line-strong"
                        style={{ backgroundColor: COLORS.scrim }}
                      >
                        <Text className="text-content-primary text-xs font-bold leading-none">×</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={handleSimulateOCR}
                      disabled={isScanningOCR}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isScanningOCR, busy: isScanningOCR }}
                      style={{ backgroundColor: isScanningOCR ? COLORS.surface05 : accentColor }}
                      className="w-full py-4 rounded-md flex-row items-center justify-center gap-2 border border-line-strong"
                    >
                      {isScanningOCR ? (
                        <>
                          <ActivityIndicator size="small" color={COLORS.contentSecondary} />
                          <Text variant="labelXs" className="text-content-secondary">Scanning Receipt...</Text>
                        </>
                      ) : (
                        <>
                          <Text className="text-sm">🔍</Text>
                          <Text variant="labelXs" style={{ color: accentColorContrast }}>Scan & Auto-Fill Form</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleAddPhoto}
                    accessibilityRole="button"
                    className="w-full py-5 border border-dashed border-line-subtle rounded-md items-center justify-center bg-surface-02 flex-row gap-2"
                  >
                    <Text className="text-xl">📷</Text>
                    <Text variant="labelXs" className="text-content-secondary">Attach Receipt Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bottom Actions */}
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setStep(3)}
                accessibilityRole="button"
                className="flex-1 py-4 bg-surface-04 border border-line-subtle rounded-md items-center"
              >
                <Text variant="labelM" className="text-content-secondary">← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-4 rounded-md items-center justify-center"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text variant="labelM" style={{ color: accentColorContrast }}>Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Custom Category Add Modal ────────────────────────────────── */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: COLORS.scrim, justifyContent: "flex-end", alignItems: "center" }}
        >
          <View className="w-full max-w-md bg-surface-03 border-t border-x border-line-subtle rounded-t-xl p-6 pb-12 flex flex-col gap-5">
            <View>
              <Text variant="headingM">Create Custom Category</Text>
              <Text variant="paragraphS" className="text-content-muted mt-1">Add a personalized category (up to 3 total).</Text>
            </View>

            <View className="flex flex-col gap-4">
              <View className="flex flex-col gap-1.5">
                <Text variant="labelXs" className="text-content-secondary">Emoji Icon</Text>
                <TextInput
                  value={customEmoji}
                  onChangeText={setCustomEmoji}
                  placeholder="🏷️"
                  placeholderTextColor={COLORS.contentMuted}
                  maxLength={5}
                  className="bg-surface-02 border border-line-subtle rounded-md px-4 py-3 text-content-primary text-base font-semibold w-20 text-center"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text variant="labelXs" className="text-content-secondary">Category Name</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Car Wash, Detailing"
                  placeholderTextColor={COLORS.contentMuted}
                  className="bg-surface-02 border border-line-subtle rounded-md px-4 py-3 text-content-primary text-sm font-semibold"
                />
              </View>
            </View>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setShowCustomModal(false)}
                accessibilityRole="button"
                className="flex-1 py-3 bg-surface-02 border border-line-subtle rounded-md items-center"
              >
                <Text variant="labelM" className="text-content-secondary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveCustomCategory}
                accessibilityRole="button"
                style={{ backgroundColor: accentColor }}
                className="flex-1 py-3 rounded-md items-center"
              >
                <Text variant="labelM" style={{ color: accentColorContrast }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
