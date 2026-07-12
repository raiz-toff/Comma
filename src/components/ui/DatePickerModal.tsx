import React, { useState } from "react";
import { Modal, View, Pressable, StyleSheet } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { COLORS } from "@/src/theme/colors";

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

/** Contrast text on an accent background (accent arrives as a prop, so no hook). */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#1a1916" : "#ffffff";
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerModal({ visible, value, onChange, onClose, accentColor = COLORS.primary }: Props) {
  // Note: accentColor is passed by callers from usePlatformTheme(); the literal default is a last-resort fallback only.
  const today = new Date();
  const [displayYear, setDisplayYear] = useState(value.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(value.getMonth());
  const [selected, setSelected] = useState<Date>(value);

  const accentContrast = getContrastColor(accentColor);

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
            <Pressable
              onPress={prevMonth}
              style={s.navBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={20} color={COLORS.contentSecondary} />
            </Pressable>
            <Text variant="headingS">{MONTHS[displayMonth]} {displayYear}</Text>
            <Pressable
              onPress={nextMonth}
              style={s.navBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={20} color={COLORS.contentSecondary} />
            </Pressable>
          </View>

          {/* Day-of-week row */}
          <View style={s.weekRow}>
            {DAYS.map(d => (
              <Text key={d} variant="labelXs" className="text-content-muted" style={s.dayName}>{d}</Text>
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
                  style={[s.cell, sel && { backgroundColor: accentColor, borderRadius: 12 }]}
                  onPress={() => handleDay(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTHS[displayMonth]} ${day}, ${displayYear}`}
                  accessibilityState={{ selected: sel }}
                >
                  <Text
                    variant="paragraphM"
                    style={[
                      tod && !sel && { color: accentColor, fontWeight: "800" as const },
                      sel && { color: accentContrast, fontWeight: "800" as const },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={s.cancelBtn}
            >
              <Text variant="labelM" className="text-content-secondary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleDone}
              accessibilityRole="button"
              style={[s.doneBtn, { backgroundColor: accentColor }]}
            >
              <Text variant="labelM" style={{ color: accentContrast }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: COLORS.scrim,
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 360,
    backgroundColor: COLORS.surface03, borderRadius: 28,   // Surface/03, DS modal radius
    borderWidth: 1, borderColor: COLORS.lineSubtle,        // Border/Subtle
    padding: 20, gap: 12,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  navBtn: { padding: 4 },
  weekRow: { flexDirection: "row" },
  dayName: { flex: 1, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    justifyContent: "center", alignItems: "center",
  },
  footer: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.surface04, alignItems: "center",   // Surface/04
  },
  doneBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
  },
});
