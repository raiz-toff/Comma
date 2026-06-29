import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";

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

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export function TimePickerModal({ visible, value, onChange, onClose, is24Hour = true, accentColor = "#10b981" }: Props) {
  const initHour = is24Hour ? value.getHours() : (value.getHours() % 12 || 12);
  const initMinute = value.getMinutes();
  const initAmpm = value.getHours() < 12 ? 0 : 1; // 0=AM, 1=PM

  const [hour, setHour] = useState(initHour);
  const [minute, setMinute] = useState(initMinute);
  const [ampm, setAmpm] = useState(initAmpm);

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
          <Text style={s.title}>Select Time</Text>

          <View style={[s.wheelRow, { height: containerH }]}>
            {/* Selection highlight — anchored to the wheel row, always centered */}
            <View
              pointerEvents="none"
              style={[s.selectionHighlight, { top: padding, height: ITEM_H, borderColor: accentColor + "55" }]}
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

            <Text style={s.colon}>:</Text>

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
                  >
                    <Text style={[s.ampmText, ampm === i && { color: "#000" }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={s.footer}>
            <Pressable onPress={onClose} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleDone} style={[s.doneBtn, { backgroundColor: accentColor }]}>
              <Text style={s.doneText}>Done</Text>
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
              <Text style={[colS.itemText, sel && { color: accentColor, fontWeight: "800", fontSize: 22 }]}>
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
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 320,
    backgroundColor: "#1a1916", borderRadius: 20,
    borderWidth: 1, borderColor: "#2a2825",
    padding: 20, gap: 16,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff", textAlign: "center" },
  wheelRow: { flexDirection: "row", alignItems: "center", gap: 4, position: "relative" },
  colon: { fontSize: 24, fontWeight: "800", color: "#71717a" },
  ampmCol: { gap: 8, justifyContent: "center" },
  ampmBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, backgroundColor: "#262422",
  },
  ampmText: { fontSize: 13, fontWeight: "700", color: "#a1a1aa" },
  selectionHighlight: {
    position: "absolute", left: 0, right: 0,
    borderRadius: 10, borderTopWidth: 1, borderBottomWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  footer: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: "#262422", alignItems: "center",
  },
  cancelText: { color: "#a1a1aa", fontWeight: "600", fontSize: 14 },
  doneBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  doneText: { color: "#000", fontWeight: "800", fontSize: 14 },
});

const colS = StyleSheet.create({
  item: { height: ITEM_H, justifyContent: "center", alignItems: "center" },
  itemText: { fontSize: 18, fontWeight: "500", color: "#52525b" },
});
