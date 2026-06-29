import React, { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  accentColor?: string;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerModal({ visible, value, onChange, onClose, accentColor = "#10b981" }: Props) {
  // Note: accentColor is passed by callers from usePlatformTheme(); the literal default is a last-resort fallback only.
  const today = new Date();
  const [displayYear, setDisplayYear] = useState(value.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(value.getMonth());
  const [selected, setSelected] = useState<Date>(value);

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  };

  const cells = buildGrid(displayYear, displayMonth);

  const isSelected = (d: number) =>
    selected.getFullYear() === displayYear &&
    selected.getMonth() === displayMonth &&
    selected.getDate() === d;

  const isToday = (d: number) =>
    today.getFullYear() === displayYear &&
    today.getMonth() === displayMonth &&
    today.getDate() === d;

  const handleDay = (d: number) => {
    const next = new Date(selected);
    next.setFullYear(displayYear);
    next.setMonth(displayMonth);
    next.setDate(d);
    setSelected(next);
  };

  const handleDone = () => {
    onChange(selected);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
              <ChevronLeft size={20} color="#9B9BA4" />
            </Pressable>
            <Text style={s.monthLabel}>{MONTHS[displayMonth]} {displayYear}</Text>
            <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
              <ChevronRight size={20} color="#9B9BA4" />
            </Pressable>
          </View>

          {/* Day-of-week row */}
          <View style={s.weekRow}>
            {DAYS.map(d => (
              <Text key={d} style={s.dayName}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={s.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={s.cell} />;
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <Pressable
                  key={i}
                  style={[s.cell, sel && { backgroundColor: accentColor, borderRadius: 10 }]}
                  onPress={() => handleDay(day)}
                >
                  <Text style={[
                    s.dayNum,
                    tod && !sel && { color: accentColor, fontWeight: "800" },
                    sel && { color: "#000", fontWeight: "800" },
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable onPress={onClose} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleDone} style={[s.doneBtn, { backgroundColor: accentColor }]}>
              <Text style={s.doneText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#16161A", borderRadius: 20,   // Surface/03, radius-xl
    borderWidth: 1, borderColor: "#1E1E23",          // Border/Subtle
    padding: 20, gap: 12,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 16, fontWeight: "600", color: "#F6F6F7" },   // Heading/S, Text/Primary
  weekRow: { flexDirection: "row" },
  dayName: {
    flex: 1, textAlign: "center",
    fontSize: 11, fontWeight: "700", color: "#65656E", textTransform: "uppercase",   // Text/Muted
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    justifyContent: "center", alignItems: "center",
  },
  dayNum: { fontSize: 14, fontWeight: "500", color: "#9B9BA4" },   // Text/Secondary
  footer: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#1C1C21", alignItems: "center",   // Surface/04
  },
  cancelText: { color: "#9B9BA4", fontWeight: "600", fontSize: 14 },   // Text/Secondary
  doneBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
  },
  doneText: { color: "#000", fontWeight: "800", fontSize: 14 },
});
