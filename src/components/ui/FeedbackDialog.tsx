import React from "react";
import { Modal, View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "@/src/components/ui/text";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react-native";
import { COLORS, withAlpha } from "@/src/theme/colors";

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
  /** Render the primary button as a destructive (red) action — e.g. "Turn off", "Delete". */
  confirmDanger?: boolean;
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

// Semantic tints (fixed). Success = COLORS.success, Danger = COLORS.destructive,
// Info = COLORS.info (falls back to user accent when provided).
const VARIANT_COLORS: Record<FeedbackVariant, string> = {
  success: COLORS.success,
  error: COLORS.destructive,
  info: COLORS.info,
};

/** Contrast text on a tint background (tint may be any caller-supplied accent). */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#1a1916" : "#ffffff";
}

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
  confirmDanger = false,
  cancelLabel,
  onConfirm,
  actions,
  onClose,
  accentColor,
}: FeedbackDialogProps) {
  const tint = variant === "info" ? accentColor || VARIANT_COLORS.info : VARIANT_COLORS[variant];
  const confirmTint = confirmDanger ? VARIANT_COLORS.error : tint;
  const handleConfirm = onConfirm ?? onClose;
  const tintContrast = getContrastColor(tint);
  const confirmContrast = confirmDanger ? COLORS.contentPrimary : getContrastColor(confirmTint);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        {/* Stop propagation so taps inside the card don't dismiss */}
        <Pressable style={s.card} onPress={() => {}}>
          <View style={[s.iconWrap, { backgroundColor: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.25) }]}>
            <VariantIcon variant={variant} color={tint} />
          </View>

          <Text variant="headingS" style={s.centered}>{title}</Text>
          {message ? <Text variant="paragraphM" style={s.centered}>{message}</Text> : null}

          {actions && actions.length > 0 ? (
            <View style={s.stack}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  style={[s.stackBtn, a.variant === "neutral" ? { backgroundColor: COLORS.surface04 } : { backgroundColor: tint }]}
                >
                  {a.variant === "neutral" ? (
                    <Text variant="labelL" className="text-content-secondary">{a.label}</Text>
                  ) : (
                    <Text variant="labelL" style={{ color: tintContrast }}>{a.label}</Text>
                  )}
                </Pressable>
              ))}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={[s.stackBtn, { backgroundColor: COLORS.surface04 }]}
              >
                <Text variant="labelL" className="text-content-secondary">{cancelLabel ?? "Cancel"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.footer}>
              {cancelLabel ? (
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  style={s.cancelBtn}
                >
                  <Text variant="labelL" className="text-content-secondary" numberOfLines={1}>{cancelLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleConfirm}
                accessibilityRole="button"
                style={[s.confirmBtn, { backgroundColor: confirmTint }]}
              >
                <Text variant="labelL" style={{ color: confirmContrast }} numberOfLines={1}>{confirmLabel}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Standalone blocking spinner overlay, themed to match the app. */
export function BusyOverlay({ visible, label, accentColor = COLORS.primary }: { visible: boolean; label?: string; accentColor?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={[s.card, { alignItems: "center", gap: 14 }]}>
          <ActivityIndicator size="large" color={accentColor} />
          {label ? <Text variant="paragraphM" style={s.centered}>{label}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.surface03,   // Surface/03
    borderRadius: 28,                    // DS modal radius
    borderWidth: 1,
    borderColor: COLORS.lineSubtle,      // Border/Subtle
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
  centered: { textAlign: "center" },
  footer: { flexDirection: "row", gap: 10, marginTop: 4, alignSelf: "stretch" },
  stack: { gap: 10, marginTop: 4, alignSelf: "stretch" },
  stackBtn: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface04,   // Surface/04
    alignItems: "center",
  },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
});
