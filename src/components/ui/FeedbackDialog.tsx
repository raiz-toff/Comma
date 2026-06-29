import React from "react";
import { Modal, View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "@/src/components/ui/text";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react-native";

export type FeedbackVariant = "success" | "error" | "info";

export interface FeedbackAction {
  label: string;
  onPress: () => void;
  /** "primary" → filled accent button, "neutral" → muted button. Defaults to "primary". */
  variant?: "primary" | "neutral";
}

interface FeedbackDialogProps {
  visible: boolean;
  variant?: FeedbackVariant;
  title: string;
  message?: string;
  /** Primary button label. Defaults to "OK". Ignored when `actions` is provided. */
  confirmLabel?: string;
  /** When provided, a secondary (cancel) button is shown. */
  cancelLabel?: string;
  /** Fired when the primary button is pressed. Falls back to onClose. */
  onConfirm?: () => void;
  /**
   * Stacked choice buttons. When provided, these replace the single confirm
   * button and a "Cancel" row is appended (label from `cancelLabel`).
   */
  actions?: FeedbackAction[];
  /** Fired on dismiss (overlay tap, hardware back, cancel button). */
  onClose: () => void;
  /** Accent color used for the "info" variant and as a fallback. */
  accentColor?: string;
}

// Semantic tints (fixed). Success = #1FC16B, Danger = #FF5247. Info falls back to user accent.
const VARIANT_COLORS: Record<FeedbackVariant, string> = {
  success: "#1FC16B",
  error: "#FF5247",
  info: "#1FC16B",
};

function VariantIcon({ variant, color }: { variant: FeedbackVariant; color: string }) {
  if (variant === "success") return <CheckCircle2 size={26} color={color} />;
  if (variant === "error") return <AlertTriangle size={26} color={color} />;
  return <Info size={26} color={color} />;
}

export function FeedbackDialog({
  visible,
  variant = "info",
  title,
  message,
  confirmLabel = "OK",
  cancelLabel,
  onConfirm,
  actions,
  onClose,
  accentColor,
}: FeedbackDialogProps) {
  const tint = variant === "info" ? accentColor || VARIANT_COLORS.info : VARIANT_COLORS[variant];
  const handleConfirm = onConfirm ?? onClose;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        {/* Stop propagation so taps inside the card don't dismiss */}
        <Pressable style={s.card} onPress={() => {}}>
          <View style={[s.iconWrap, { backgroundColor: tint + "1f", borderColor: tint + "40" }]}>
            <VariantIcon variant={variant} color={tint} />
          </View>

          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}

          {actions && actions.length > 0 ? (
            <View style={s.stack}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={[
                    s.stackBtn,
                    a.variant === "neutral" ? { backgroundColor: "#1C1C21" } : { backgroundColor: tint },
                  ]}
                >
                  <Text style={a.variant === "neutral" ? s.cancelText : s.confirmText}>{a.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={onClose} style={[s.stackBtn, { backgroundColor: "#1C1C21" }]}>
                <Text style={s.cancelText}>{cancelLabel ?? "Cancel"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.footer}>
              {cancelLabel ? (
                <Pressable onPress={onClose} style={s.cancelBtn}>
                  <Text style={s.cancelText}>{cancelLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleConfirm} style={[s.confirmBtn, { backgroundColor: tint }]}>
                <Text style={s.confirmText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Standalone blocking spinner overlay, themed to match the app. */
export function BusyOverlay({ visible, label, accentColor = "#10b981" }: { visible: boolean; label?: string; accentColor?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={[s.card, { alignItems: "center", gap: 14 }]}>
          <ActivityIndicator size="large" color={accentColor} />
          {label ? <Text style={s.message}>{label}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#16161A",   // Surface/03
    borderRadius: 20,             // radius-xl (sheets)
    borderWidth: 1,
    borderColor: "#1E1E23",       // Border/Subtle
    padding: 24,
    gap: 14,
    alignItems: "center",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#F6F6F7", textAlign: "center" },     // Heading/S, Text/Primary
  message: { fontSize: 14, fontWeight: "400", color: "#9B9BA4", textAlign: "center", lineHeight: 20 }, // Paragraph/M, Text/Secondary
  footer: { flexDirection: "row", gap: 10, marginTop: 4, alignSelf: "stretch" },
  stack: { gap: 10, marginTop: 4, alignSelf: "stretch" },
  stackBtn: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#1C1C21",   // Surface/04
    alignItems: "center",
  },
  cancelText: { color: "#9B9BA4", fontWeight: "600", fontSize: 14 },   // Text/Secondary
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  confirmText: { color: "#000", fontWeight: "800", fontSize: 14 },     // dark text on tint (contrast)
});
