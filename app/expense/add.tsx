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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/app/(tabs)/expenses/index";
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

  // ── Form State ───────────────────────────────────────────────────────────
  const [category, setCategory] = useState<ExpenseCategoryId>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [isDeductible, setIsDeductible] = useState(true);
  const [linkedShiftId, setLinkedShiftId] = useState(prefillShiftId || "");
  const [linkedVehicleId, setLinkedVehicleId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // ── UI State ─────────────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const { data: recentShifts = [] } = useQuery({
    queryKey: ["shifts", 1],
    queryFn: () => getShiftsPaginated(1),
  });

  // ── Pre-populate when editing ─────────────────────────────────────────────
  useEffect(() => {
    if (existingExpense) {
      setCategory((existingExpense.category as ExpenseCategoryId) || "fuel");
      setAmount(String(existingExpense.amount || ""));
      setDate(new Date(existingExpense.date));
      setIsDeductible(!!existingExpense.isDeductible);
      setLinkedShiftId(existingExpense.shiftId || "");
      setLinkedVehicleId(existingExpense.vehicleId || "");
      setNotes(existingExpense.notes || "");
      setReceiptUri(existingExpense.receiptUri || null);
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
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-slate-300 text-xs font-semibold">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">
          {isEditing ? "Edit Expense" : "Add Expense"}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="py-2 px-4 bg-emerald-500 rounded-lg"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-xs font-bold uppercase tracking-wider">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-6">
        {/* Error */}
        {errorMessage ? (
          <View className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
            <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        {/* ── 1. Category Selector ─────────────────────────────────────── */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Category *</Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id as ExpenseCategoryId)}
                  className={cn(
                    "flex-row items-center gap-1.5 px-3 py-2 rounded-xl border",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-900/40"
                  )}
                >
                  <Text className="text-lg leading-none">{cat.icon}</Text>
                  <Text
                    className={cn(
                      "text-xs font-bold",
                      isSelected ? "text-emerald-400" : "text-slate-400"
                    )}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 2. Amount ────────────────────────────────────────────────── */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Amount ($) *</Text>
          <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <Text className="text-slate-400 text-lg px-4">$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#475569"
              className="flex-1 py-3.5 text-slate-100 text-lg font-extrabold"
            />
          </View>
        </View>

        {/* ── 3. Date ──────────────────────────────────────────────────── */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Date</Text>
          {isWeb ? (
            <input
              type="date"
              value={date.toISOString().substring(0, 10)}
              onChange={(e) => {
                if (e.target.value) setDate(new Date(e.target.value + "T12:00:00"));
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm w-full outline-none focus:border-emerald-500"
            />
          ) : (
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-row justify-between items-center"
            >
              <Text className="text-slate-100 text-sm font-semibold">
                {date.toLocaleDateString(undefined, { dateStyle: "medium" })}
              </Text>
              <Text className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">Select</Text>
            </TouchableOpacity>
          )}
          {showDatePicker && (
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

        {/* ── 4. Deductible Toggle ─────────────────────────────────────── */}
        <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3.5 flex-row justify-between items-center">
          <View className="flex-col gap-0.5">
            <Text className="text-sm font-bold text-slate-100">Tax Deductible</Text>
            <Text className="text-[10px] text-slate-500 font-medium">
              Mark if this is a deductible business expense
            </Text>
          </View>
          <Switch
            value={isDeductible}
            onValueChange={setIsDeductible}
            trackColor={{ false: "#1e293b", true: "#10b981" }}
            thumbColor="#fff"
          />
        </View>

        {/* ── 5. Link to Vehicle ───────────────────────────────────────── */}
        {vehiclesList.length > 0 && (
          <View className="flex flex-col gap-2">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Link to Vehicle</Text>
            <View className="flex flex-col gap-2">
              {/* "None" option */}
              <TouchableOpacity
                onPress={() => setLinkedVehicleId("")}
                className={cn(
                  "px-3.5 py-2.5 rounded-xl border",
                  !linkedVehicleId ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800 bg-slate-900/40"
                )}
              >
                <Text className={cn("text-xs font-bold", !linkedVehicleId ? "text-emerald-400" : "text-slate-400")}>
                  None
                </Text>
              </TouchableOpacity>
              {vehiclesList.map((v: any) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setLinkedVehicleId(v.id)}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl border flex-row justify-between items-center",
                    linkedVehicleId === v.id ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800 bg-slate-900/40"
                  )}
                >
                  <Text className={cn("text-xs font-bold", linkedVehicleId === v.id ? "text-emerald-400" : "text-slate-200")}>
                    {v.name}
                  </Text>
                  <Text className="text-[10px] text-slate-500">{v.year} {v.make} {v.model}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── 6. Link to Shift (recent shifts) ─────────────────────────── */}
        {recentShifts.length > 0 && (
          <View className="flex flex-col gap-2">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">
              Link to Shift <Text className="text-slate-600 normal-case font-normal">(Optional)</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {/* None option */}
                <TouchableOpacity
                  onPress={() => setLinkedShiftId("")}
                  className={cn(
                    "px-3 py-2 rounded-xl border min-w-[60px] items-center",
                    !linkedShiftId ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/40"
                  )}
                >
                  <Text className={cn("text-xs font-bold", !linkedShiftId ? "text-emerald-400" : "text-slate-400")}>
                    None
                  </Text>
                </TouchableOpacity>
                {recentShifts.slice(0, 8).map((shift: any) => {
                  const isSelected = linkedShiftId === shift.id;
                  const dateStr = new Date(shift.startTime).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <TouchableOpacity
                      key={shift.id}
                      onPress={() => setLinkedShiftId(isSelected ? "" : shift.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl border flex-col items-center gap-1",
                        isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/40"
                      )}
                    >
                      <PlatformBadge platform={shift.platform as PlatformKey} size="sm" />
                      <Text className={cn("text-[9px] font-bold", isSelected ? "text-emerald-400" : "text-slate-500")}>
                        {dateStr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── 7. Notes ─────────────────────────────────────────────────── */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Receipt number, details, or description..."
            placeholderTextColor="#475569"
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm h-24 font-medium"
          />
        </View>

        {/* ── 8. Receipt Photo ─────────────────────────────────────────── */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Receipt Photo</Text>
          {receiptUri ? (
            <View className="flex flex-col gap-2">
              {isWeb ? (
                <View className="bg-slate-900 border border-slate-800 rounded-2xl p-3 items-center">
                  <Text className="text-emerald-400 text-xs font-bold">📎 Photo attached</Text>
                  <Text className="text-slate-500 text-[10px] mt-0.5" numberOfLines={1}>{receiptUri}</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: receiptUri }}
                  className="w-full h-40 rounded-2xl border border-slate-800"
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                onPress={() => setReceiptUri(null)}
                className="self-start px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10"
              >
                <Text className="text-rose-400 text-xs font-bold">Remove Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={pickReceiptPhoto}
                className="flex-1 py-3.5 border border-dashed border-slate-700 rounded-2xl items-center justify-center gap-1.5 flex-col bg-slate-900/30"
              >
                <Text className="text-2xl leading-none">🖼️</Text>
                <Text className="text-xs font-bold text-slate-400">Photo Library</Text>
              </TouchableOpacity>
              {!isWeb && (
                <TouchableOpacity
                  onPress={takeReceiptPhoto}
                  className="flex-1 py-3.5 border border-dashed border-slate-700 rounded-2xl items-center justify-center gap-1.5 flex-col bg-slate-900/30"
                >
                  <Text className="text-2xl leading-none">📷</Text>
                  <Text className="text-xs font-bold text-slate-400">Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
