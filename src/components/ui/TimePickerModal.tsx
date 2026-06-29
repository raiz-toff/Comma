import React, { useRef, useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";

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

  const hourRef = useRef<ScrollView>(null);
  const minRef = useRef<ScrollView>(null);

  // Scroll to initial values when modal opens
  useEffect(() => {
    if (!visible) return;
    const hi = is24Hour ? initHour : initHour - 1;
    const mi = initMinute;
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: hi * ITEM_H, animated: false });
      minRef.current?.scrollTo({ y: mi * ITEM_H, animated: false });
    }, 50);
  }, [visible]);

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

  const onHourScroll = (y: number) => {
    const idx = Math.round(y / ITEM_H);
    setHour(hours[Math.max(0, Math.min(idx, hours.length - 1))]);
  };
  const onMinScroll = (y: number) => {
    const idx = Math.round(y / ITEM_H);
    setMinute(minutes[Math.max(0, Math.min(idx, 59))]);
  };

  const containerH = ITEM_H * VISIBLE;
  const padding = ITEM_H * Math.floor(VISIBLE / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>Select Time</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {/* Hours */}
            <Column
              items={hours}
              selected={is24Hour ? hour : (hour === 0 ? 12 : hour)}
              ref={hourRef}
              onScroll={onHourScroll}
              containerH={containerH}
              padding={padding}
              accentColor={accentColor}
              format={pad}
            />

            <Text style={s.colon}>:</Text>

            {/* Minutes */}
            <Column
              items={minutes}
              selected={minute}
              ref={minRef}
              onScroll={onMinScroll}
              containerH={containerH}
              padding={padding}
              accentColor={accentColor}
              format={pad}
            />

            {/* AM/PM */}
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

          {/* Selection highlight overlay (pointer-events none) */}
          <View pointerEvents="none" style={[s.selectionHighlight, { top: (containerH - ITEM_H) / 2 + 44, borderColor: accentColor + "40" }]} />

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

const Column = React.forwardRef<ScrollView, {
  items: number[];
  selected: number;
  onScroll: (y: number) => void;
  containerH: number;
  padding: number;
  accentColor: string;
  format: (n: number) => string;
}>(({ items, selected, onScroll, containerH, padding, accentColor, format }, ref) => (
  <View style={{ flex: 1, height: containerH, overflow: "hidden" }}>
    <ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={e => onScroll(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={e => onScroll(e.nativeEvent.contentOffset.y)}
      contentContainerStyle={{ paddingVertical: padding }}
    >
      {items.map((item) => {
        const sel = item === selected;
        return (
          <View key={item} style={[colS.item]}>
            <Text style={[colS.itemText, sel && { color: accentColor, fontWeight: "800", fontSize: 22 }]}>
              {format(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  </View>
));

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
  colon: { fontSize: 24, fontWeight: "800", color: "#71717a", marginBottom: 4 },
  ampmCol: { gap: 8, justifyContent: "center" },
  ampmBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, backgroundColor: "#262422",
  },
  ampmText: { fontSize: 13, fontWeight: "700", color: "#a1a1aa" },
  selectionHighlight: {
    position: "absolute", left: 20, right: 20, height: ITEM_H,
    borderRadius: 10, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.03)",
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
