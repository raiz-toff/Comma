import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Text } from "@/src/components/ui/text";
import { COLORS, withAlpha } from "@/src/theme/colors";

const ITEM_H = 48;
const VISIBLE = 5; // rows visible, selection is the center one

interface Props {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  is24Hour?: boolean;
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

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export function TimePickerModal({ visible, value, onChange, onClose, is24Hour = true, accentColor = COLORS.primary }: Props) {
  const initHour = is24Hour ? value.getHours() : (value.getHours() % 12 || 12);
  const initMinute = value.getMinutes();
  const initAmpm = value.getHours() < 12 ? 0 : 1; // 0=AM, 1=PM

  const [hour, setHour] = useState(initHour);
  const [minute, setMinute] = useState(initMinute);
  const [ampm, setAmpm] = useState(initAmpm);

  const accentContrast = getContrastColor(accentColor);

  const hourCount = is24Hour ? 24 : 12;
  const hours = Array.from({ length: hourCount }, (_, i) => is24Hour ? i : i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Re-mount the wheels whenever the modal opens so they reset to the
  // incoming `value` and re-run their initial scroll positioning.
  const [openKey, setOpenKey] = useState(0);
  const wasVisible = useRef(visible);
  if (visible && !wasVisible.current) {
    setHour(initHour);
    setMinute(initMinute);
    setAmpm(initAmpm);
    setOpenKey(k => k + 1);
  }
  wasVisible.current = visible;

  const hourInitIdx = is24Hour ? initHour : initHour - 1;

  const handleDone = () => {
    const next = new Date(value);
    if (is24Hour) {
      next.setHours(hour, minute, 0, 0);
    } else {
      let h = hour % 12;
      if (ampm === 1) h += 12;
      next.setHours(h, minute, 0, 0);
    }
    onChange(next);
    onClose();
  };

  const containerH = ITEM_H * VISIBLE;
  const padding = ITEM_H * Math.floor(VISIBLE / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Backdrop is a sibling, not an ancestor — so it can't intercept the
            wheel scroll gesture (a Pressable wrapping the ScrollView would). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <Text variant="headingS" style={s.title}>Select Time</Text>

          <View style={[s.wheelRow, { height: containerH }]}>
            {/* Selection highlight — anchored to the wheel row, always centered */}
            <View
              pointerEvents="none"
              style={[s.selectionHighlight, { top: padding, height: ITEM_H, borderColor: withAlpha(accentColor, 0.25) }]}
            />

            <WheelColumn
              key={`h-${openKey}`}
              data={hours}
              initialIndex={hourInitIdx}
              onSelect={i => setHour(hours[i])}
              containerH={containerH}
              padding={padding}
              accentColor={accentColor}
              format={pad}
            />

            <Text variant="headingL" className="text-content-muted">:</Text>

            <WheelColumn
              key={`m-${openKey}`}
              data={minutes}
              initialIndex={initMinute}
              onSelect={i => setMinute(minutes[i])}
              containerH={containerH}
              padding={padding}
              accentColor={accentColor}
              format={pad}
            />

            {!is24Hour && (
              <View style={s.ampmCol}>
                {["AM", "PM"].map((label, i) => (
                  <Pressable
                    key={label}
                    style={[s.ampmBtn, ampm === i && { backgroundColor: accentColor }]}
                    onPress={() => setAmpm(i)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: ampm === i }}
                  >
                    <Text
                      variant="labelM"
                      className="text-content-secondary"
                      style={ampm === i && { color: accentContrast }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

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
        </View>
      </View>
    </Modal>
  );
}

interface WheelProps {
  data: number[];
  initialIndex: number;
  onSelect: (index: number) => void;
  containerH: number;
  padding: number;
  accentColor: string;
  format: (n: number) => string;
}

function WheelColumn({ data, initialIndex, onSelect, containerH, padding, accentColor, format }: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const [active, setActive] = useState(initialIndex);

  const indexFromOffset = (y: number) =>
    Math.max(0, Math.min(Math.round(y / ITEM_H), data.length - 1));

  // Live highlight while the wheel moves.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(indexFromOffset(e.nativeEvent.contentOffset.y));
  };

  // Commit the value once the wheel settles.
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = indexFromOffset(e.nativeEvent.contentOffset.y);
    setActive(idx);
    onSelect(idx);
  };

  return (
    <View style={{ flex: 1, height: containerH, overflow: "hidden" }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
        onContentSizeChange={() => {
          if (didInit.current) return;
          didInit.current = true;
          scrollRef.current?.scrollTo({ y: initialIndex * ITEM_H, animated: false });
        }}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {data.map((item, i) => {
          const sel = i === active;
          return (
            <View key={item} style={colS.item}>
              <Text
                tabular
                style={[colS.itemText, sel && { color: accentColor, fontWeight: "800" as const, fontSize: 22 }]}
              >
                {format(item)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: COLORS.scrim,
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 320,
    backgroundColor: COLORS.surface03, borderRadius: 28,   // Surface/03, DS modal radius
    borderWidth: 1, borderColor: COLORS.lineSubtle,        // Border/Subtle
    padding: 20, gap: 16,
  },
  title: { textAlign: "center" },
  wheelRow: { flexDirection: "row", alignItems: "center", gap: 4, position: "relative" },
  ampmCol: { gap: 8, justifyContent: "center" },
  ampmBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.surface04,   // Surface/04
  },
  selectionHighlight: {
    position: "absolute", left: 0, right: 0,
    borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1,
    backgroundColor: COLORS.surface04,
  },
  footer: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.surface04, alignItems: "center",   // Surface/04
  },
  doneBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
});

const colS = StyleSheet.create({
  item: { height: ITEM_H, justifyContent: "center", alignItems: "center" },
  // Explicit size kept: the selected row interpolates 18→22, which no single
  // variant expresses; lineHeight 28 prevents clipping at the 22px state.
  itemText: { fontSize: 18, lineHeight: 28, fontWeight: "500", color: COLORS.contentMuted },
});
