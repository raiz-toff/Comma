import React from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { getExpenseById, deleteExpense } from "@/src/database/queries/expenses";
import { getShiftById } from "@/src/database/queries/shifts";
import { getVehicleById } from "@/src/database/queries/vehicles";
import { getCategoryMeta } from "@/src/registry/expenseCategories";
import { ExpenseCategoryIcon } from "@/src/components/ui/ExpenseCategoryIcon";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

const BG      = "#0c0b09";
const SURFACE = "#131211";
const BORDER  = "#222120";
const MUTED   = "#9B9BA4";
const DIM     = "#2E2E36";
const WHITE   = "#F6F6F7";
const GREEN   = "#34d399";
const RED     = "#f87171";

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
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

  if (isLoading || !expense) {
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loading}>
          <Text style={{ color: MUTED, fontSize: 14 }}>Loading…</Text>
        </View>
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
          <ChevronLeft size={20} color={MUTED} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expense Detail</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={12} style={s.headerBtn}>
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
          <View style={[s.iconWrap, { borderColor: accentColor + "28", backgroundColor: accentColor + "10" }]}>
            <ExpenseCategoryIcon id={expense.category} size={24} color={accentColor} />
          </View>

          {/* Category + merchant label */}
          <Text style={s.categoryLabel}>{meta.label}</Text>
          {expense.merchant ? (
            <Text style={s.merchantLabel}>{expense.merchant}</Text>
          ) : null}

          {/* Amount — split into symbol · whole · .cents to avoid clipping */}
          <View style={s.amountRow}>
            <Text style={s.amountSymbol}>{currSymbol}</Text>
            <Text style={s.amountWhole}>{whole}</Text>
            <Text style={s.amountCents}>.{cents}</Text>
          </View>

          {/* Date pill */}
          <View style={s.datePill}>
            <Text style={s.datePillText}>{dateStr}</Text>
          </View>
        </View>

        {/* ── Deductibility status ────────────────────────────────────── */}
        <View style={[
          s.statusBar,
          isBusinessExp
            ? { backgroundColor: "rgba(52,211,153,0.07)", borderColor: "rgba(52,211,153,0.18)" }
            : { backgroundColor: "rgba(248,113,113,0.07)", borderColor: "rgba(248,113,113,0.18)" },
        ]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.statusTitle, { color: isBusinessExp ? GREEN : RED }]}>
              {isBusinessExp ? "Business Expense" : "Personal · Not Deductible"}
            </Text>
            {isPartial && (
              <Text style={s.statusSub}>{deductiblePct}% business use</Text>
            )}
          </View>
          {isBusinessExp && (
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text style={s.statusAmtLabel}>Deductible</Text>
              <Text style={[s.statusAmt, { color: GREEN }]}>
                {currSymbol}{deductibleAmt.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Tax code ────────────────────────────────────────────────── */}
        {meta.taxCode && isBusinessExp && (
          <View style={s.taxRow}>
            <View style={[s.taxBadge, { backgroundColor: accentColor + "15", borderColor: accentColor + "22" }]}>
              <Text style={[s.taxCode, { color: accentColor }]}>{meta.taxCode}</Text>
            </View>
            <Text style={s.taxLine} numberOfLines={1}>{meta.taxCodeLabel}</Text>
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
                  <Text style={s.noteText}>{meta.deductibleNote}</Text>
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
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesBody}>{expense.notes}</Text>
          </View>
        ) : null}

        {/* ── Receipt ─────────────────────────────────────────────────── */}
        {expense.receiptUri ? (
          <View style={[s.card, { overflow: "hidden" }]}>
            <Text style={[s.notesLabel, { paddingBottom: 0 }]}>Receipt</Text>
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
          style={[s.editBtn, { backgroundColor: accentColor }]}
          activeOpacity={0.85}
        >
          <Pencil size={15} color={accentColorContrast} />
          <Text style={[s.editBtnText, { color: accentColorContrast }]}>Edit Expense</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  // header
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  headerBtn:   { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700", color: WHITE, letterSpacing: 0.1 },

  scroll: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 52, gap: 10 },

  // amount block
  amountBlock:   { alignItems: "center", paddingVertical: 20, gap: 4 },
  iconWrap:      { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  categoryLabel: { fontSize: 13, fontWeight: "600", color: MUTED, letterSpacing: 0.2 },
  merchantLabel: { fontSize: 11, fontWeight: "500", color: DIM, marginTop: 1 },
  amountRow:     { flexDirection: "row", alignItems: "flex-end", marginTop: 10, gap: 1 },
  amountSymbol:  { fontSize: 22, fontWeight: "700", color: MUTED, marginBottom: 4, lineHeight: 28 },
  amountWhole:   { fontSize: 48, fontWeight: "800", color: WHITE, lineHeight: 56, letterSpacing: -1.5 },
  amountCents:   { fontSize: 22, fontWeight: "600", color: MUTED, marginBottom: 6, lineHeight: 28 },
  datePill:      { marginTop: 10, backgroundColor: SURFACE, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 5 },
  datePillText:  { fontSize: 12, fontWeight: "600", color: MUTED },

  // status bar
  statusBar:     { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  statusTitle:   { fontSize: 13, fontWeight: "700" },
  statusSub:     { fontSize: 11, fontWeight: "500", color: MUTED },
  statusAmtLabel:{ fontSize: 9, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  statusAmt:     { fontSize: 16, fontWeight: "800" },

  // tax code
  taxRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  taxBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  taxCode:  { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, fontVariant: ["tabular-nums"] },
  taxLine:  { fontSize: 12, fontWeight: "500", color: MUTED, flex: 1 },

  // info card
  card:     { backgroundColor: SURFACE, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER, overflow: "hidden" },
  sep:      { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 16 },
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowLabel: { fontSize: 13, fontWeight: "500", color: MUTED, flexShrink: 0 },
  rowValue: { fontSize: 13, fontWeight: "600", color: WHITE, textAlign: "right", flex: 1 },

  // note inside deductibility card
  noteWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  noteText: { fontSize: 11, fontWeight: "500", color: DIM, lineHeight: 17 },

  // notes section
  notesLabel: { fontSize: 10, fontWeight: "700", color: DIM, textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 6 },
  notesBody:  { fontSize: 14, fontWeight: "400", color: WHITE, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 14 },

  // receipt
  receiptImg: { width: "100%", height: 200, marginTop: 8 },

  // edit button
  editBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 13, marginTop: 4 },
  editBtnText: { fontSize: 14, fontWeight: "800" },
});
