/**
 * Full-screen "turn on end-to-end encryption" flow.
 *
 * This is deliberately a TAKEOVER, not a small dialog. Enabling E2EE is the only action in
 * the app that can render the user's data PERMANENTLY unrecoverable — there is no server, no
 * reset link, no support path. If they forget this password, the cloud copy is mathematically
 * gone. A 6-line modal is the wrong weight for that; WhatsApp uses a full screen for the same
 * reason.
 *
 * Two gates, in order:
 *   1. RISK  — the consequence, stated plainly, behind an explicit "I understand" checkbox.
 *              The Continue button stays disabled until it's ticked.
 *   2. CREATE — set + confirm the password, with a nudge to save it in a password manager and
 *              a reveal toggle so they can actually check what they typed before committing.
 */

import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/src/components/ui/text";
import {
  ShieldCheck,
  TriangleAlert,
  KeyRound,
  Check,
  X,
  Eye,
  EyeOff,
  CloudOff,
  Lock,
} from "lucide-react-native";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";

export const MIN_E2EE_PW = 8;

export function E2EESetupScreen({
  accentColor,
  accentColorContrast,
  onCancel,
  onConfirm,
}: {
  accentColor: string;
  accentColorContrast: string;
  onCancel: () => void;
  onConfirm: (password: string) => void | Promise<void>;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const [stage, setStage] = useState<"risk" | "create">("risk");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (pw.length < MIN_E2EE_PW) {
      setErr(`Use at least ${MIN_E2EE_PW} characters.`);
      return;
    }
    if (pw !== confirm) {
      setErr("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(pw);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView style={s.safe}>
        {/* Close */}
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

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {stage === "risk" ? (
            <RiskStage
              acknowledged={acknowledged}
              setAcknowledged={setAcknowledged}
              accentColor={accentColor}
              accentColorContrast={accentColorContrast}
              onContinue={() => setStage("create")}
            />
          ) : (
            <CreateStage
              pw={pw}
              setPw={(v) => { setPw(v); setErr(""); }}
              confirm={confirm}
              setConfirm={(v) => { setConfirm(v); setErr(""); }}
              reveal={reveal}
              setReveal={setReveal}
              err={err}
              saving={saving}
              accentColor={accentColor}
              accentColorContrast={accentColorContrast}
              onBack={() => setStage("risk")}
              onSubmit={submit}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Stage 1: the risk ────────────────────────────────────────────────────────

function RiskStage({
  acknowledged,
  setAcknowledged,
  accentColor,
  accentColorContrast,
  onContinue,
}: {
  acknowledged: boolean;
  setAcknowledged: (v: boolean) => void;
  accentColor: string;
  accentColorContrast: string;
  onContinue: () => void;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.3) }]}>
            <ShieldCheck size={34} color={accentColor} strokeWidth={1.8} />
          </View>
          <Text variant="headingL" style={{ textAlign: "center" }}>
            End-to-end encryption
          </Text>
          <Text variant="paragraphM" style={{ textAlign: "center", maxWidth: 320 }}>
            Your backup gets locked with a password only you know. Not even Google can read it.
          </Text>
        </View>

        {/* What changes */}
        <View style={s.card}>
          <Row
            icon={<Lock size={18} color={C.success} />}
            title="Your data is scrambled before it leaves this phone"
            sub="Google stores a locked box it has no key to."
          />
          <Row
            icon={<KeyRound size={18} color={C.success} />}
            title="You'll need this password on every device"
            sub="Signing into Google is no longer enough on its own."
            bordered
          />
        </View>

        {/* The consequence — the whole point of this screen */}
        <View style={[s.warnCard, { backgroundColor: withAlpha(C.destructive, 0.09), borderColor: withAlpha(C.destructive, 0.35) }]}>
          <View style={s.warnHead}>
            <TriangleAlert size={19} color={C.destructive} />
            <Text variant="labelL" style={{ color: C.destructive }}>
              If you lose it, your data is gone
            </Text>
          </View>
          <Text variant="paragraphM" style={{ color: C.contentSecondary }}>
            There is no reset link and no support recovery. Comma runs no server and never sees
            your password — so nobody, including us, can unlock your backup for you.
          </Text>
          <View style={s.warnBullets}>
            <WarnBullet text="We cannot email you a new one." />
            <WarnBullet text="Google cannot recover it." />
            <WarnBullet text="Reinstalling the app will not help." />
          </View>
          <Text variant="paragraphS" style={{ color: C.contentSecondary, marginTop: 2 }}>
            Write it down, or save it in a password manager, before you continue.
          </Text>
        </View>

        {/* Explicit acknowledgement — this is what unlocks Continue */}
        <Pressable
          onPress={() => setAcknowledged(!acknowledged)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged }}
          style={[
            s.ackRow,
            acknowledged && { borderColor: withAlpha(accentColor, 0.5), backgroundColor: withAlpha(accentColor, 0.06) },
          ]}
        >
          <View
            style={[
              s.checkbox,
              acknowledged
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : { borderColor: C.lineStrong },
            ]}
          >
            {acknowledged ? <Check size={13} color={accentColorContrast} strokeWidth={3.5} /> : null}
          </View>
          <Text variant="paragraphM" style={{ flex: 1, color: C.contentPrimary }}>
            I understand that if I forget this password, my cloud backup can never be recovered.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          onPress={acknowledged ? onContinue : undefined}
          disabled={!acknowledged}
          accessibilityRole="button"
          accessibilityState={{ disabled: !acknowledged }}
          style={[
            s.primaryBtn,
            { backgroundColor: accentColor, opacity: acknowledged ? 1 : 0.35 },
          ]}
        >
          <Text variant="headingS" style={{ color: accentColorContrast }}>Continue</Text>
        </Pressable>
      </View>
    </>
  );
}

// ── Stage 2: create the password ─────────────────────────────────────────────

function CreateStage({
  pw,
  setPw,
  confirm,
  setConfirm,
  reveal,
  setReveal,
  err,
  saving,
  accentColor,
  accentColorContrast,
  onBack,
  onSubmit,
}: {
  pw: string;
  setPw: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  reveal: boolean;
  setReveal: (v: boolean) => void;
  err: string;
  saving: boolean;
  accentColor: string;
  accentColorContrast: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const tooShort = pw.length > 0 && pw.length < MIN_E2EE_PW;
  const ready = pw.length >= MIN_E2EE_PW && confirm.length > 0 && !saving;

  return (
    <>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.3) }]}>
            <KeyRound size={34} color={accentColor} strokeWidth={1.8} />
          </View>
          <Text variant="headingL" style={{ textAlign: "center" }}>
            Create your password
          </Text>
          <Text variant="paragraphM" style={{ textAlign: "center", maxWidth: 320 }}>
            This is the only key to your backup. Save it somewhere safe right now — you'll need
            it on every other device.
          </Text>
        </View>

        <View style={s.inputWrap}>
          <Text variant="labelXs" className="text-content-muted" style={{ marginBottom: 6 }}>
            PASSWORD
          </Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={pw}
              onChangeText={setPw}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              placeholder={`At least ${MIN_E2EE_PW} characters`}
              placeholderTextColor={C.contentMuted}
            />
            <Pressable
              onPress={() => setReveal(!reveal)}
              accessibilityRole="button"
              accessibilityLabel={reveal ? "Hide password" : "Show password"}
              hitSlop={8}
              style={s.revealBtn}
            >
              {reveal
                ? <EyeOff size={18} color={C.contentSecondary} />
                : <Eye size={18} color={C.contentSecondary} />}
            </Pressable>
          </View>
          {tooShort ? (
            <Text variant="paragraphS" style={{ color: C.warning, marginTop: 6 }}>
              {MIN_E2EE_PW - pw.length} more character{MIN_E2EE_PW - pw.length === 1 ? "" : "s"} needed
            </Text>
          ) : null}
        </View>

        <View style={s.inputWrap}>
          <Text variant="labelXs" className="text-content-muted" style={{ marginBottom: 6 }}>
            CONFIRM PASSWORD
          </Text>
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Type it again"
            placeholderTextColor={C.contentMuted}
          />
        </View>

        {err ? (
          <View style={[s.errBox, { backgroundColor: withAlpha(C.destructive, 0.1), borderColor: withAlpha(C.destructive, 0.3) }]}>
            <TriangleAlert size={15} color={C.destructive} />
            <Text variant="paragraphM" style={{ color: C.destructive, flex: 1 }}>{err}</Text>
          </View>
        ) : null}

        {/* Final standing reminder — visible at the moment of commitment */}
        <View style={[s.reminder, { borderColor: withAlpha(C.warning, 0.3), backgroundColor: withAlpha(C.warning, 0.07) }]}>
          <CloudOff size={16} color={C.warning} />
          <Text variant="paragraphS" style={{ flex: 1, color: C.contentSecondary }}>
            Comma has no copy of this password. If it's lost, the backup can't be opened again —
            by anyone.
          </Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          onPress={ready ? onSubmit : undefined}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={[s.primaryBtn, { backgroundColor: accentColor, opacity: ready ? 1 : 0.35 }]}
        >
          <Text variant="headingS" style={{ color: accentColorContrast }}>
            {saving ? "Encrypting…" : "Turn on encryption"}
          </Text>
        </Pressable>
        <Pressable
          onPress={saving ? undefined : onBack}
          accessibilityRole="button"
          style={s.secondaryBtn}
        >
          <Text variant="labelM" style={{ color: C.contentMuted }}>Back</Text>
        </Pressable>
      </View>
    </>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────────

function Row({
  icon,
  title,
  sub,
  bordered,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  bordered?: boolean;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.row, bordered && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSubtle }]}>
      <View style={s.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="labelM">{title}</Text>
        <Text variant="paragraphS" style={{ marginTop: 2 }}>{sub}</Text>
      </View>
    </View>
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

  card: {
    backgroundColor: C.surface02,
    borderWidth: 1,
    borderColor: C.lineSubtle,
    borderRadius: 16,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface04,
    alignItems: "center",
    justifyContent: "center",
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

  inputWrap: { gap: 0 },
  inputRow: { position: "relative", justifyContent: "center" },
  input: {
    backgroundColor: C.surface03,
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    paddingRight: 48,
    color: C.contentPrimary,
    fontSize: 16,
  },
  revealBtn: { position: "absolute", right: 14, padding: 4 },

  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  reminder: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
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
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: { paddingVertical: 14, alignItems: "center" },
});
