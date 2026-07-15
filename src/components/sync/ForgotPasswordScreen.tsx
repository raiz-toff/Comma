/**
 * Full-screen "forgot your backup password" confirmation (plans/008 Phase 1, scenario 6).
 *
 * A forgotten password is mathematically unrecoverable — that's what makes it secure. But the
 * remedy is NOT a device wipe: deleting Drive files needs no key, so we throw away the
 * unreadable cloud copy and rebuild it from THIS phone's still-readable local data under a new
 * password. This phone's data is kept. The only thing lost is changes that live only on
 * another device and were never pulled here. Full screen + an explicit "I understand" gate,
 * same weight as SetBackupPasswordScreen, because it's still irreversible for that cloud copy.
 */

import React, { useState } from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/src/components/ui/text";
import { TriangleAlert, Check, X, RotateCcw } from "lucide-react-native";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";

export function ForgotPasswordScreen({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const [acknowledged, setAcknowledged] = useState(false);
  const [resetting, setResetting] = useState(false);

  const submit = async () => {
    setResetting(true);
    try {
      await onConfirm();
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={10}
            style={s.closeBtn}
          >
            <X size={20} color={C.contentSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <View style={[s.heroIcon, { backgroundColor: withAlpha(C.destructive, 0.12), borderColor: withAlpha(C.destructive, 0.3) }]}>
              <TriangleAlert size={34} color={C.destructive} strokeWidth={1.8} />
            </View>
            <Text variant="headingL" style={{ textAlign: "center" }}>
              Forgot your password?
            </Text>
            <Text variant="paragraphM" style={{ textAlign: "center", maxWidth: 320 }}>
              We can't recover an encrypted password — that's what makes it secure.
            </Text>
          </View>

          <View style={[s.warnCard, { backgroundColor: withAlpha(C.destructive, 0.09), borderColor: withAlpha(C.destructive, 0.35) }]}>
            <View style={s.warnHead}>
              <TriangleAlert size={19} color={C.destructive} />
              <Text variant="labelL" style={{ color: C.destructive }}>
                This rebuilds your cloud backup from scratch
              </Text>
            </View>
            <Text variant="paragraphM" style={{ color: C.contentSecondary }}>
              You'll set a new password, and this phone's data will back up fresh under it.
            </Text>
            <View style={s.warnBullets}>
              <WarnBullet text="The data on this phone is kept — nothing here is erased." />
              <WarnBullet text="The old, unreadable cloud backup is deleted." />
              <WarnBullet text="Changes that were only on another device, never synced here, are lost." />
              <WarnBullet text="Your other devices will need the new password to sync again." />
            </View>
          </View>

          <Pressable
            onPress={() => setAcknowledged(!acknowledged)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            style={[
              s.ackRow,
              acknowledged && { borderColor: withAlpha(C.destructive, 0.5), backgroundColor: withAlpha(C.destructive, 0.06) },
            ]}
          >
            <View
              style={[
                s.checkbox,
                acknowledged
                  ? { backgroundColor: C.destructive, borderColor: C.destructive }
                  : { borderColor: C.lineStrong },
              ]}
            >
              {acknowledged ? <Check size={13} color="#ffffff" strokeWidth={3.5} /> : null}
            </View>
            <Text variant="paragraphM" style={{ flex: 1, color: C.contentPrimary }}>
              I understand the old cloud backup will be deleted and this can't be undone.
            </Text>
          </Pressable>
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={acknowledged && !resetting ? submit : undefined}
            disabled={!acknowledged || resetting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !acknowledged || resetting }}
            style={[s.primaryBtn, { backgroundColor: C.destructive, opacity: acknowledged ? 1 : 0.35 }]}
          >
            <RotateCcw size={17} color="#ffffff" />
            <Text variant="headingS" style={{ color: "#ffffff" }}>
              {resetting ? "Working…" : "Continue — set a new password"}
            </Text>
          </Pressable>
          <Pressable
            onPress={resetting ? undefined : onCancel}
            accessibilityRole="button"
            style={s.secondaryBtn}
          >
            <Text variant="labelM" style={{ color: C.contentMuted }}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function WarnBullet({ text }: { text: string }) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.warnBullet}>
      <View style={[s.dot, { backgroundColor: C.destructive }]} />
      <Text variant="paragraphM" style={{ color: C.contentSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface03,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },

  hero: { alignItems: "center", gap: 10, marginBottom: 4 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  warnCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  warnHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  warnBullets: { gap: 6, marginTop: 2 },
  warnBullet: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  ackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    backgroundColor: C.surface02,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineSubtle,
  },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: { paddingVertical: 14, alignItems: "center" },
});
