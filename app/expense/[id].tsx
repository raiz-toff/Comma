import React from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { getExpenseById, deleteExpense } from "@/src/database/queries/expenses";
import { getShiftById } from "@/src/database/queries/shifts";
import { getVehicleById } from "@/src/database/queries/vehicles";
import { getCategoryMeta } from "@/src/registry/expenseCategories";
import { ExpenseCategoryIcon } from "@/src/components/ui/ExpenseCategoryIcon";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { COLORS, withAlpha } from "@/src/theme/colors";

const BG      = COLORS.background;
const SURFACE = COLORS.surface02;
const BORDER  = COLORS.lineSubtle;
const MUTED   = COLORS.contentSecondary;
const WHITE   = COLORS.contentPrimary;
const GREEN   = COLORS.success;
const RED     = COLORS.destructive;

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.row}>
      <Text variant="labelM" className="text-content-secondary" style={{ flexShrink: 0 }}>{label}</Text>
      <Text
        variant="labelM"
        tabular
        style={[{ textAlign: "right", flex: 1 }, valueColor ? { color: valueColor } : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function Sep() {
  return <View style={s.sep} />;
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { profile } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const country          = profile?.country ?? "CA";
  const customCategories = profile?.customCategories ?? [];
  const currSymbol       = profile?.locale?.currency === "GBP" ? "£" : "$";

  const { data: expense, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: () => getExpenseById(id!),
    enabled: !!id,
  });

  const { data: linkedShift } = useQuery({
    queryKey: ["shift", expense?.shiftId],
    queryFn: () => getShiftById(expense!.shiftId),
    enabled: !!expense?.shiftId,
  });

  const { data: linkedVehicle } = useQuery({
    queryKey: ["vehicle", expense?.vehicleId],
    queryFn: () => getVehicleById(expense!.vehicleId),
    enabled: !!expense?.vehicleId,
  });

  const handleDelete = () => {
    Alert.alert("Delete Expense", "This will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteExpense(id!);
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          router.back();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loading}>
          <ActivityIndicator color={COLORS.contentSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="receipt"
          title="Expense not found"
          message="This expense may have been deleted or is no longer available."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const meta            = getCategoryMeta(expense.category, country, customCategories);
  const deductiblePct   = expense.deductiblePct ?? 100;
  const rawAmount       = expense.amount ?? 0;
  const deductibleAmt   = expense.isDeductible ? rawAmount * (deductiblePct / 100) : 0;
  const isBusinessExp   = !!expense.isDeductible;
  const isPartial       = isBusinessExp && deductiblePct < 100;

  const dateStr = expense.date
    ? new Date(expense.date).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : "—";

  const shiftLabel   = linkedShift
    ? `${linkedShift.platform}  ·  ${new Date(linkedShift.startTime).toLocaleDateString()}`
    : null;
  const vehicleLabel = linkedVehicle
    ? [linkedVehicle.name, linkedVehicle.make, linkedVehicle.model].filter(Boolean).join(" ")
    : null;

  // Format amount parts for clean display
  const [whole, cents] = rawAmount.toFixed(2).split(".");

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.headerBtn}
        >
          <ChevronLeft size={20} color={MUTED} />
        </TouchableOpacity>
        <Text variant="labelL">Expense Detail</Text>
        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Delete expense"
          style={s.headerBtn}
        >
          <Trash2 size={17} color={RED} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Amount + Category block ─────────────────────────────────── */}
        <View style={s.amountBlock}>
          {/* Icon */}
          <View style={[s.iconWrap, { borderColor: withAlpha(accentColor, 0.25), backgroundColor: withAlpha(accentColor, 0.12) }]}>
            <ExpenseCategoryIcon id={expense.category} size={24} color={accentColor} />
          </View>

          {/* Category + merchant label */}
          <Text variant="labelM" className="text-content-secondary">{meta.label}</Text>
          {expense.merchant ? (
            <Text variant="paragraphS" style={{ marginTop: 1 }}>{expense.merchant}</Text>
          ) : null}

          {/* Amount — split into symbol · whole · .cents to avoid clipping */}
          <View style={s.amountRow}>
            <Text style={s.amountSymbol} tabular>{currSymbol}</Text>
            <Text style={s.amountWhole} tabular>{whole}</Text>
            <Text style={s.amountCents} tabular>.{cents}</Text>
          </View>

          {/* Date pill */}
          <View style={s.datePill}>
            <Text variant="paragraphS" className="text-content-secondary">{dateStr}</Text>
          </View>
        </View>

        {/* ── Deductibility status ────────────────────────────────────── */}
        <View style={[
          s.statusBar,
          isBusinessExp
            ? { backgroundColor: withAlpha(GREEN, 0.12), borderColor: withAlpha(GREEN, 0.25) }
            : { backgroundColor: withAlpha(RED, 0.12), borderColor: withAlpha(RED, 0.25) },
        ]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelM" style={{ color: isBusinessExp ? GREEN : RED }}>
              {isBusinessExp ? "Business Expense" : "Personal · Not Deductible"}
            </Text>
            {isPartial && (
              <Text variant="paragraphS" tabular className="text-content-secondary">{deductiblePct}% business use</Text>
            )}
          </View>
          {isBusinessExp && (
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text variant="labelXs" className="text-content-secondary">Deductible</Text>
              <Text variant="headingS" tabular style={{ color: GREEN }}>
                {currSymbol}{deductibleAmt.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Tax code ────────────────────────────────────────────────── */}
        {meta.taxCode && isBusinessExp && (
          <View style={s.taxRow}>
            <View style={[s.taxBadge, { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.25) }]}>
              <Text variant="labelXs" tabular style={{ color: accentColor }}>{meta.taxCode}</Text>
            </View>
            <Text variant="paragraphS" className="text-content-secondary flex-1" numberOfLines={1}>{meta.taxCodeLabel}</Text>
          </View>
        )}

        {/* ── Info card ───────────────────────────────────────────────── */}
        <View style={s.card}>
          <Row label="Date" value={dateStr} />
          <Sep />
          <Row label="Category" value={meta.label} />
          {expense.merchant ? (
            <>
              <Sep />
              <Row label="Merchant" value={expense.merchant} />
            </>
          ) : null}
          {expense.isRecurring ? (
            <>
              <Sep />
              <Row
                label="Recurring"
                value={expense.recurringInterval
                  ? expense.recurringInterval.charAt(0).toUpperCase() + expense.recurringInterval.slice(1)
                  : "Yes"}
                valueColor={accentColor}
              />
            </>
          ) : null}
        </View>

        {/* ── Deductibility breakdown ──────────────────────────────────── */}
        {isBusinessExp && (
          <View style={s.card}>
            <Row label="Business Use" value={`${deductiblePct}%`} />
            <Sep />
            <Row label="Full Amount" value={`${currSymbol}${rawAmount.toFixed(2)}`} />
            <Sep />
            <Row label="Deductible Amount" value={`${currSymbol}${deductibleAmt.toFixed(2)}`} valueColor={GREEN} />
            {meta.deductibleNote ? (
              <>
                <Sep />
                <View style={s.noteWrap}>
                  <Text variant="paragraphS">{meta.deductibleNote}</Text>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* ── Context links ────────────────────────────────────────────── */}
        {(shiftLabel || vehicleLabel) ? (
          <View style={s.card}>
            {shiftLabel ? <Row label="Linked Shift" value={shiftLabel} /> : null}
            {shiftLabel && vehicleLabel ? <Sep /> : null}
            {vehicleLabel ? <Row label="Vehicle" value={vehicleLabel} /> : null}
          </View>
        ) : null}

        {/* ── Notes ───────────────────────────────────────────────────── */}
        {expense.notes ? (
          <View style={s.card}>
            <Text variant="labelXs" className="text-content-muted" style={s.notesLabel}>Notes</Text>
            <Text variant="paragraphM" className="text-content-primary" style={s.notesBody}>{expense.notes}</Text>
          </View>
        ) : null}

        {/* ── Receipt ─────────────────────────────────────────────────── */}
        {expense.receiptUri ? (
          <View style={[s.card, { overflow: "hidden" }]}>
            <Text variant="labelXs" className="text-content-muted" style={[s.notesLabel, { paddingBottom: 0 }]}>Receipt</Text>
            <Image
              source={{ uri: expense.receiptUri }}
              style={s.receiptImg}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* ── Edit button ──────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/expense/add", params: { expenseId: id } })}
          accessibilityRole="button"
          style={[s.editBtn, { backgroundColor: accentColor }]}
          activeOpacity={0.85}
        >
          <Pencil size={15} color={accentColorContrast} />
          <Text variant="labelM" style={{ color: accentColorContrast }}>Edit Expense</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  // header
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 52, gap: 10 },

  // amount block
  amountBlock:  { alignItems: "center", paddingVertical: 20, gap: 4 },
  iconWrap:     { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  amountRow:    { flexDirection: "row", alignItems: "flex-end", marginTop: 10, gap: 1 },
  amountSymbol: { fontSize: 22, fontWeight: "700", color: MUTED, marginBottom: 4, lineHeight: 28 },
  amountWhole:  { fontSize: 48, fontWeight: "800", color: WHITE, lineHeight: 56, letterSpacing: -1.5 },
  amountCents:  { fontSize: 22, fontWeight: "600", color: MUTED, marginBottom: 6, lineHeight: 28 },
  datePill:     { marginTop: 10, backgroundColor: SURFACE, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 5 },

  // status bar
  statusBar: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },

  // tax code
  taxRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  taxBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },

  // info card
  card: { backgroundColor: SURFACE, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER, overflow: "hidden" },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 16 },
  row:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },

  // note inside deductibility card
  noteWrap: { paddingHorizontal: 16, paddingVertical: 12 },

  // notes section
  notesLabel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  notesBody:  { paddingHorizontal: 16, paddingBottom: 14 },

  // receipt
  receiptImg: { width: "100%", height: 200, marginTop: 8 },

  // edit button
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 12, marginTop: 4 },
});
